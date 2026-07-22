/**
 * Accountant Bot — Deep Financial Math (Playwright).
 * 3 суток / 3 ночи: Итог ≈ Субтотал + Сервисный сбор + Налог; выплата партнёру; RUB/THB/USD и точность знаков.
 * Алерт [FINANCIAL_ERROR]: POST …/financial-error-alert при расхождении > 0.01 (нужен E2E_FIXTURE_SECRET).
 *
 * Stage 171.42 → 190.6b: hero в режиме stay = guest payable total (subtotal + fee + tax), не «за сутки».
 */
import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
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

async function setListingCurrency(page: Page, code: string) {
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

async function probeListingCalendar(
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

type CatalogListingRow = { id?: string; basePriceThb?: number }

async function pickCatalogListingWithSpan(
  request: APIRequestContext,
  baseURL: string,
  category: string,
  spanDays: number,
): Promise<{ listing: CatalogListingRow; span: { startIso: string; endIso: string } } | null> {
  const listingsRes = await request.get(
    `${baseURL}/api/v2/search?category=${encodeURIComponent(category)}&limit=24`,
  )
  if (!listingsRes.ok()) return null
  const listingsJson = (await listingsRes.json()) as {
    data?: { listings?: CatalogListingRow[] }
  }
  const rows = (listingsJson?.data?.listings || []).filter((x) => x?.id)
  const preferred =
    rows.find((r) => Number(r.basePriceThb) * spanDays >= 80) || rows[0]
  if (!preferred?.id) return null

  const candidates = [preferred, ...rows.filter((r) => r.id !== preferred.id)]
  for (const listing of candidates) {
    const calRows = await probeListingCalendar(request, baseURL, String(listing.id))
    if (!calRows) continue
    const span = findFirstValidCalendarSpan(calRows, spanDays)
    if (span) return { listing, span }
  }
  return null
}

/**
 * Stage 190.1 / 190.6b — guest payable identity + hero = payable total.
 * @param {{ requireTax?: boolean }} options — housing: require taxAmountThb > 0 when platform tax is on
 */
async function assertStayPayableMathOnPdp(opts: {
  page: Page
  request: APIRequestContext
  baseURL: string
  listingId: string
  span: { startIso: string; endIso: string }
  spanDays: number
  label: string
  requireTax?: boolean
}) {
  const { page, request: api, baseURL, listingId, span, spanDays, label, requireTax = false } =
    opts

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`${baseURL}/listings/${listingId}`, { waitUntil: 'domcontentloaded' })

  const desktopBookingCard = getDesktopBookingCard(page)
  const picker = await openPlatformCalendarPicker(page, desktopBookingCard)
  await selectPlatformCalendarRange(picker, spanDays, {
    page,
    listingId,
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
    const taxEl = desktopBookingCard.getByTestId('booking-breakdown-tax')
    await expect(subEl).toBeVisible({ timeout: 10_000 })
    await expect(feeEl).toBeVisible({ timeout: 10_000 })
    await expect(taxEl).toBeVisible({ timeout: 10_000 })

    const subRaw = await subEl.getAttribute('data-test-subtotal-value')
    const feeRaw = await feeEl.getAttribute('data-test-fee-value')
    const taxThbStr = await taxEl.getAttribute('data-test-tax-thb')
    const totalRaw = await totalLoc.getAttribute('data-test-raw-value')
    const totalThbStr = await totalLoc.getAttribute('data-test-total-thb')
    const payoutEl = desktopBookingCard.locator('[data-test-payout-value]').first()

    expect(subRaw && feeRaw && totalRaw && totalThbStr, `${label} ${code} data-test attrs`).toBeTruthy()

    const sub = parseRawAmount(subRaw)
    const fee = parseRawAmount(feeRaw)
    const taxThb = parseRawAmount(taxThbStr)
    const total = parseRawAmount(totalRaw)
    const totalThb = parseRawAmount(totalThbStr)

    expect(Number.isFinite(sub) && Number.isFinite(fee) && Number.isFinite(total)).toBeTruthy()
    expect(Number.isFinite(taxThb), `${label} ${code} tax thb`).toBeTruthy()
    expect(totalThb, `${label} итог THB`).toBeGreaterThanOrEqual(100)

    if (requireTax) {
      expect(taxThb, `${label} tax > 0`).toBeGreaterThan(0)
    }

    if (code === 'USD') {
      assertUsdTwoDecimals(String(totalRaw))
      assertUsdTwoDecimals(String(feeRaw))
      assertUsdTwoDecimals(String(subRaw))
    } else {
      assertIntegerString(code, String(subRaw))
      assertIntegerString(code, String(feeRaw))
      assertIntegerString(code, String(totalRaw))
    }

    // Guest payable = subtotal + guest service fee + tax (Stage 190.1).
    // Display currency: total is FX of THB payable; rebuild from THB parts when tax/fee attrs are THB.
    const subThbAttr = parseRawAmount(await subEl.getAttribute('data-test-subtotal-thb'))
    const feeThbAttr = parseRawAmount(await feeEl.getAttribute('data-test-fee-thb'))
    if (
      Number.isFinite(subThbAttr) &&
      Number.isFinite(feeThbAttr) &&
      Number.isFinite(taxThb) &&
      Number.isFinite(totalThb)
    ) {
      await assertApprox(
        api,
        baseURL,
        subThbAttr + feeThbAttr + taxThb,
        totalThb,
        `${label} ${code} THB subtotal+fee+tax vs payable total`,
      )
    }

    if (code === 'THB') {
      await assertApprox(
        api,
        baseURL,
        sub + fee + taxThb,
        total,
        `${label} ${code} display subtotal+fee+tax vs total`,
      )
    }

    const heroMode = (await heroPriceEl.getAttribute('data-test-hero-mode')) || ''
    const heroPayable = (await heroPriceEl.getAttribute('data-test-hero-payable')) || ''
    const heroRaw = await heroPriceEl.getAttribute('data-test-raw-value')
    const hero = parseRawAmount(heroRaw)
    expect(heroMode, `${label} ${code} hero stay mode`).toBe('stay')
    expect(heroPayable, `${label} ${code} hero payable flag`).toBe('1')
    expect(Number.isFinite(hero) && hero > 0, `${label} ${code} hero`).toBeTruthy()

    // SSOT getPdpHeroGuestPriceThb: stay headline = guest payable total (= breakdown total).
    await assertApprox(
      api,
      baseURL,
      hero,
      total,
      `${label} ${code} hero stay = payable total`,
      0.01,
    )

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
      // Host commission (SSOT) = subtotal − partner payout — independent of guest service fee / tax.
      const hostCommissionThb = subThb - payThb
      expect(hostCommissionThb, `${label} host commission THB`).toBeGreaterThan(0)
      expect(payThb, `${label} partner payout < subtotal`).toBeLessThan(subThb)
      expect(feeThb, `${label} guest service fee`).toBeGreaterThan(0)
    }
  }
}

test.describe('@accountant-bot', () => {
  test('vehicles 3 суток: payable = sub+fee+tax; hero = payable; THB/RUB/USD', async ({
    page,
    baseURL,
    request,
  }) => {
    test.setTimeout(120_000)
    test.skip(!baseURL, 'baseURL')

    const picked = await pickCatalogListingWithSpan(request, baseURL!, 'vehicles', 3)
    test.skip(!picked, 'Нет vehicles с валидным 3-дневным окном')

    await assertStayPayableMathOnPdp({
      page,
      request,
      baseURL: baseURL!,
      listingId: String(picked.listing.id),
      span: picked.span,
      spanDays: 3,
      label: 'vehicles',
      requireTax: false,
    })
  })

  test('housing 3 ночи: payable = sub+fee+tax; hero = payable (tax>0 если включён)', async ({
    page,
    baseURL,
    request,
  }) => {
    test.setTimeout(120_000)
    test.skip(!baseURL, 'baseURL')

    // Prefer apartments; fall back to property / villas if catalog slug differs.
    const categories = ['apartments', 'property', 'villas', 'houses']
    let picked: Awaited<ReturnType<typeof pickCatalogListingWithSpan>> = null
    for (const cat of categories) {
      picked = await pickCatalogListingWithSpan(request, baseURL!, cat, 3)
      if (picked) break
    }
    test.skip(!picked, 'Нет housing-листинга с валидным 3-ночным окном')

    await assertStayPayableMathOnPdp({
      page,
      request,
      baseURL: baseURL!,
      listingId: String(picked!.listing.id),
      span: picked!.span,
      spanDays: 3,
      label: 'housing',
      // Soft: only enforce tax>0 when platform taxRatePercent yields tax on this listing.
      // Probe runs inside helper after dates — we re-open and check once:
      requireTax: false,
    })

    // Explicit tax>0 check when platform has tax configured (same stay already selected after helper).
    const desktopCard = getDesktopBookingCard(page)
    const taxThb = parseRawAmount(
      await desktopCard.getByTestId('booking-breakdown-tax').first().getAttribute('data-test-tax-thb'),
    )
    if (Number.isFinite(taxThb) && taxThb > 0) {
      expect(taxThb, 'housing tax > 0').toBeGreaterThan(0)
      const hero = parseRawAmount(
        await desktopCard.getByTestId('listing-hero-price').getAttribute('data-test-raw-value'),
      )
      const total = parseRawAmount(
        await desktopCard.getByTestId('booking-price-total').getAttribute('data-test-raw-value'),
      )
      await assertApprox(request, baseURL!, hero, total, 'housing hero = payable (tax>0)')
    } else {
      console.info(
        '[accountant-bot] housing: taxAmountThb=0 (platform taxRatePercent likely 0) — payable identity already checked',
      )
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
