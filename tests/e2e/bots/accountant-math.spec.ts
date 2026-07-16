/**
 * Accountant Bot — Deep Financial Math (Playwright).
 * 3 суток / 3 ночи: Итог ≈ Субтотал + Сервисный сбор; выплата партнёру; RUB/THB/USD и точность знаков.
 * Алерт [FINANCIAL_ERROR]: POST …/financial-error-alert при расхождении > 0.01 (нужен E2E_FIXTURE_SECRET).
 *
 * Stage 171.42: hero в режиме stay = subtotal+fee (не «за сутки»); host commission ≠ guest fee.
 */
import { test, expect, type APIRequestContext } from '@playwright/test'
import {
  E2E_EMAILS,
  E2E_FIXTURE_SECRET,
  E2E_HEADERS,
  E2E_ROUTES,
} from '../constants'
import { findFirstValidCalendarSpan, pickVehicleNDayRange } from '../helpers/vehicle-calendar-range'
import {
  closePlatformCalendarPicker,
  getDesktopBookingCard,
  openPlatformCalendarPicker,
  selectPlatformCalendarRange,
  waitForBookingPriceTotal,
} from '../helpers/platform-calendar-picker'

function parseRawAmount(s: string | null): number {
  if (s == null || s === '') return NaN
  const t = String(s).trim().replace(/\s/g, '').replace(',', '.')
  const n = parseFloat(t)
  return Number.isFinite(n) ? n : NaN
}

async function reportFinancialMismatch(
  request: APIRequestContext,
  baseURL: string,
  detail: string,
) {
  if (!E2E_FIXTURE_SECRET) {
    console.warn('[accountant-bot] E2E_FIXTURE_SECRET missing — skip Telegram:', detail)
    return
  }
  const res = await request.post(`${baseURL}${E2E_ROUTES.financialErrorAlert}`, {
    headers: { [E2E_HEADERS.fixtureSecretHeader]: E2E_FIXTURE_SECRET },
    data: { detail },
  })
  if (!res.ok()) {
    console.warn('[accountant-bot] financial-error-alert', res.status(), await res.text().catch(() => ''))
  }
}

async function setListingCurrency(page: import('@playwright/test').Page, code: string) {
  await page.evaluate((c) => {
    try {
      localStorage.setItem('gostaylo_currency', c)
      window.dispatchEvent(new CustomEvent('currency-change', { detail: c }))
    } catch {
      /* ignore */
    }
  }, code)
}

async function assertApprox(
  request: APIRequestContext,
  baseURL: string,
  expected: number,
  actual: number,
  label: string,
  tol = 0.01,
) {
  if (Math.abs(expected - actual) <= tol) return
  const detail = `Mismatch: Expected ${expected}, Got ${actual} (${label})`
  await reportFinancialMismatch(request, baseURL, detail)
  throw new Error(detail)
}

function assertIntegerString(code: string, raw: string) {
  if (code === 'USD') return
  expect(raw, `${code} без дробной части`).toMatch(/^\d+$/)
}

function assertUsdTwoDecimals(raw: string) {
  expect(raw, 'USD ровно 2 знака').toMatch(/^\d+\.\d{2}$/)
}

async function probeVehicleCalendar(
  request: APIRequestContext,
  baseURL: string,
  listingId: string,
) {
  const calRes = await request.get(`${baseURL}/api/v2/listings/${listingId}/calendar?days=180`, {
    failOnStatusCode: false,
  })
  if (!calRes.ok()) return null
  const calJson = (await calRes.json()) as {
    success?: boolean
    data?: { calendar?: Array<{ date?: string; can_check_in?: boolean }> }
  }
  const calRows = calJson?.data?.calendar
  if (!Array.isArray(calRows)) return null
  return calRows
}

test.describe('@accountant-bot', () => {
  test('3 суток: субтотал + сбор = итог; выплата; THB/RUB/USD; мин. 100 THB', async ({
    page,
    baseURL,
    request,
  }) => {
    test.setTimeout(120_000)
    test.skip(!baseURL, 'baseURL')

    const api = request
    const listingsRes = await api.get(`${baseURL}/api/v2/search?category=vehicles&limit=24`)
    expect(listingsRes.ok()).toBeTruthy()
    const listingsJson = (await listingsRes.json()) as {
      data?: { listings?: Array<{ id?: string; basePriceThb?: number }> }
    }
    const rows = (listingsJson?.data?.listings || []).filter((x) => x?.id)
    const vehicle =
      rows.find((r) => Number(r.basePriceThb) * 3 >= 80) || rows[0]
    test.skip(!vehicle?.id, 'Нет листинга vehicles для сценария')

    const calRows = await probeVehicleCalendar(api, baseURL!, String(vehicle.id))
    test.skip(!calRows, 'calendar rows')
    const checkInDays = calRows.filter((d) => d?.can_check_in === true)
    test.skip(checkInDays.length === 0, 'нет can_check_in')
    const span = findFirstValidCalendarSpan(calRows, 3)
    test.skip(!span, 'нет валидного 3-дневного окна')

    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`${baseURL}/listings/${vehicle.id}`, { waitUntil: 'domcontentloaded' })

    const desktopBookingCard = getDesktopBookingCard(page)
    const picker = await openPlatformCalendarPicker(page, desktopBookingCard)
    await selectPlatformCalendarRange(picker, 3, {
      page,
      listingId: String(vehicle.id),
      desktopBookingCard,
      knownStartIso: span.startIso,
      knownEndIso: span.endIso,
    })
    await closePlatformCalendarPicker(page)

    const totalLoc = await waitForBookingPriceTotal(desktopBookingCard)

    const heroPriceEl = desktopBookingCard.getByTestId('listing-hero-price')

    const currencies = ['THB', 'RUB', 'USD'] as const

    for (const code of currencies) {
      await setListingCurrency(page, code)
      await expect(totalLoc).toBeVisible({ timeout: 15_000 })
      await expect
        .poll(async () => parseRawAmount(await totalLoc.getAttribute('data-test-raw-value')), {
          timeout: 12_000,
        })
        .toBeGreaterThan(0)

      const subEl = desktopBookingCard.locator('[data-test-subtotal-value]').first()
      const feeEl = desktopBookingCard.getByTestId('booking-breakdown-service-fee')
      await expect(subEl).toBeVisible({ timeout: 10_000 })
      await expect(feeEl).toBeVisible({ timeout: 10_000 })

      const subRaw = await subEl.getAttribute('data-test-subtotal-value')
      const feeRaw = await feeEl.getAttribute('data-test-fee-value')
      const totalRaw = await totalLoc.getAttribute('data-test-raw-value')
      const totalThbStr = await totalLoc.getAttribute('data-test-total-thb')
      const payoutEl = desktopBookingCard.locator('[data-test-payout-value]').first()

      expect(subRaw && feeRaw && totalRaw && totalThbStr, `${code} data-test attrs`).toBeTruthy()

      const sub = parseRawAmount(subRaw)
      const fee = parseRawAmount(feeRaw)
      const total = parseRawAmount(totalRaw)
      const totalThb = parseRawAmount(totalThbStr)

      expect(Number.isFinite(sub) && Number.isFinite(fee) && Number.isFinite(total)).toBeTruthy()
      expect(totalThb, 'итог THB').toBeGreaterThanOrEqual(100)

      if (code === 'USD') {
        assertUsdTwoDecimals(String(totalRaw))
        assertUsdTwoDecimals(String(feeRaw))
        assertUsdTwoDecimals(String(subRaw))
      } else {
        assertIntegerString(code, String(subRaw))
        assertIntegerString(code, String(feeRaw))
        assertIntegerString(code, String(totalRaw))
      }

      // Vehicles: tax typically 0 — guest payable = subtotal + guest service fee.
      await assertApprox(api, baseURL!, sub + fee, total, `${code} subtotal+fee vs total`)

      const heroMode = (await heroPriceEl.getAttribute('data-test-hero-mode')) || ''
      const heroRaw = await heroPriceEl.getAttribute('data-test-raw-value')
      const hero = parseRawAmount(heroRaw)
      if (Number.isFinite(hero) && hero > 0) {
        if (heroMode === 'stay') {
          // SSOT getPdpHeroGuestPriceThb: stay headline = subtotal + guest fee (not per-night × N).
          await assertApprox(
            api,
            baseURL!,
            hero,
            sub + fee,
            `${code} hero stay = subtotal+fee`,
            Math.max(1, total * 0.01),
          )
          await assertApprox(
            api,
            baseURL!,
            hero,
            total,
            `${code} hero stay ≈ guest total`,
            Math.max(1, total * 0.01),
          )
        } else {
          await assertApprox(
            api,
            baseURL!,
            hero * 3 + fee,
            total,
            `${code} (цена за суток × 3) + сбор vs итог`,
            Math.max(2, total * 0.02),
          )
        }
      }

      await expect(payoutEl).toBeAttached({ timeout: 5000 })
      const payRaw = await payoutEl.getAttribute('data-test-payout-value')
      expect(payRaw).toBeTruthy()
      const payout = parseRawAmount(payRaw)
      expect(Number.isFinite(payout)).toBeTruthy()

      if (code === 'USD') {
        assertUsdTwoDecimals(String(payRaw))
      } else {
        assertIntegerString(code, String(payRaw))
      }

      if (code === 'THB') {
        const subThb = parseRawAmount(await subEl.getAttribute('data-test-subtotal-thb'))
        const feeThb = parseRawAmount(await feeEl.getAttribute('data-test-fee-thb'))
        const payThb = parseRawAmount(await payoutEl.getAttribute('data-test-payout-thb'))
        expect(Number.isFinite(subThb) && Number.isFinite(feeThb) && Number.isFinite(payThb)).toBeTruthy()
        // Host commission (SSOT) = subtotal − partner payout — independent of guest service fee.
        const hostCommissionThb = subThb - payThb
        expect(hostCommissionThb, 'host commission THB').toBeGreaterThan(0)
        expect(payThb, 'partner payout < subtotal').toBeLessThan(subThb)
        expect(feeThb, 'guest service fee').toBeGreaterThan(0)
      }
    }
  })
})

test.describe('accountant-bot anti-tamper', () => {
  test('POST /api/v2/promo-codes/validate: несуществующий промокод → 400', async ({
    request,
    baseURL,
  }) => {
    test.skip(!baseURL, 'baseURL')
    const r = await request.post(`${baseURL}/api/v2/promo-codes/validate`, {
      headers: { 'Content-Type': 'application/json' },
      data: { code: '__E2E_NO_SUCH_PROMO__', amount: 50_000 },
    })
    expect(r.status()).toBe(400)
    const j = (await r.json()) as { valid?: boolean; success?: boolean; error_code?: string }
    expect(j.valid === false || j.success === false).toBeTruthy()
    expect(j.error_code).toBe('PROMO_NOT_FOUND')
  })

  test('POST /api/v2/bookings: подмена clientQuotedSubtotalThb → 400 PRICE_MISMATCH', async ({
    playwright,
    baseURL,
  }) => {
    test.skip(!baseURL, 'baseURL')
    const ctx = await playwright.request.newContext({
      baseURL,
      storageState: 'playwright/.auth/user.json',
    })
    try {
      const meRes = await ctx.get('/api/v2/auth/me')
      test.skip(!meRes.ok(), 'auth /me')
      const meJson = (await meRes.json()) as { success?: boolean; user?: { id?: string } }
      const renterId = meJson?.success && meJson?.user?.id ? meJson.user.id : null
      test.skip(!renterId, 'renter id')

      const range = await pickVehicleNDayRange(ctx, baseURL, 3)
      test.skip(!range, 'vehicle calendar')

      // Prefer far-future window to avoid 409 date conflicts from parallel fixtures.
      const farCheckIn = (() => {
        const d = new Date()
        d.setUTCDate(d.getUTCDate() + 180)
        return d.toISOString().slice(0, 10)
      })()
      const farCheckOut = (() => {
        const d = new Date(`${farCheckIn}T12:00:00.000Z`)
        d.setUTCDate(d.getUTCDate() + 3)
        return d.toISOString().slice(0, 10)
      })()

      let postRes = await ctx.post('/api/v2/bookings', {
        headers: { 'Content-Type': 'application/json' },
        data: {
          listingId: range.listingId,
          renterId,
          checkIn: farCheckIn,
          checkOut: farCheckOut,
          guestName: 'E2E Price Guard',
          guestEmail: E2E_EMAILS.renter,
          guestPhone: '+66000000000',
          currency: 'THB',
          guestsCount: 1,
          clientQuotedSubtotalThb: 1,
        },
      })
      if (postRes.status() === 409) {
        postRes = await ctx.post('/api/v2/bookings', {
          headers: { 'Content-Type': 'application/json' },
          data: {
            listingId: range.listingId,
            renterId,
            checkIn: range.checkIn,
            checkOut: range.checkOut,
            guestName: 'E2E Price Guard',
            guestEmail: E2E_EMAILS.renter,
            guestPhone: '+66000000000',
            currency: 'THB',
            guestsCount: 1,
            clientQuotedSubtotalThb: 1,
          },
        })
      }
      const body = (await postRes.json()) as { code?: string; error?: string }
      expect(
        postRes.status(),
        `expected PRICE_MISMATCH guard, got ${postRes.status()} ${body?.code || body?.error || ''}`,
      ).toBe(400)
      expect(body.code).toBe('PRICE_MISMATCH')
    } finally {
      await ctx.dispose()
    }
  })
})
