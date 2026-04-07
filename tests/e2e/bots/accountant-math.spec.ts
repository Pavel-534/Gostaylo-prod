/**
 * Accountant Bot — Deep Financial Math (Playwright).
 * 3 суток / 3 ночи: Итог ≈ Субтотал + Сервисный сбор; выплата партнёру; RUB/THB/USD и точность знаков.
 * Алерт [FINANCIAL_ERROR]: POST …/financial-error-alert при расхождении > 0.01 (нужен E2E_FIXTURE_SECRET).
 */
import { test, expect, type APIRequestContext } from '@playwright/test'
import {
  E2E_FIXTURE_SECRET,
  E2E_HEADERS,
  E2E_ROUTES,
} from '../constants'

function addListingDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

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

test.describe('@accountant-bot', () => {
  test('3 суток: субтотал + сбор = итог; выплата; THB/RUB/USD; мин. 100 THB', async ({
    page,
    baseURL,
    request,
  }) => {
    test.setTimeout(120_000)
    test.skip(!baseURL, 'baseURL')

    const api = request
    const listingsRes = await api.get(`${baseURL}/api/v2/listings?category=vehicles&limit=24`)
    expect(listingsRes.ok()).toBeTruthy()
    const listingsJson = (await listingsRes.json()) as {
      data?: Array<{ id?: string; basePriceThb?: number }>
    }
    const rows = (listingsJson?.data || []).filter((x) => x?.id)
    const vehicle =
      rows.find((r) => Number(r.basePriceThb) * 3 >= 80) || rows[0]
    test.skip(!vehicle?.id, 'Нет листинга vehicles для сценария')

    await page.setViewportSize({ width: 1280, height: 900 })

    const calResponsePromise = page.waitForResponse(
      (r) => {
        const u = r.url()
        return (
          u.includes(`/api/v2/listings/${vehicle.id}/calendar`) &&
          u.includes('days=180') &&
          r.request().method() === 'GET'
        )
      },
      { timeout: 90_000 },
    )
    await page.goto(`${baseURL}/listings/${vehicle.id}`, { waitUntil: 'domcontentloaded' })
    const calResponse = await calResponsePromise
    expect(calResponse.ok(), 'calendar API').toBeTruthy()
    const calJson = (await calResponse.json()) as {
      success?: boolean
      data?: { calendar?: Array<{ date?: string; can_check_in?: boolean }> }
    }
    const calRows = calJson?.data?.calendar
    test.skip(!Array.isArray(calRows), 'calendar rows')
    const checkInDays = calRows.filter((d) => d?.can_check_in === true)
    test.skip(checkInDays.length === 0, 'нет can_check_in')

    const desktopBookingCard = page.locator('div.hidden.lg\\:block.sticky.top-24')
    const calendarTrigger = desktopBookingCard.getByTestId('gostaylo-calendar-trigger')
    await expect(calendarTrigger).toBeVisible({ timeout: 25_000 })
    await calendarTrigger.click()

    const datePickerDialog = page.getByRole('dialog')
    await expect(datePickerDialog).toBeVisible({ timeout: 15_000 })
    const firstDay = datePickerDialog.locator('button[data-clickable="true"]').first()
    await expect(firstDay).toBeVisible({ timeout: 25_000 })
    const startIso = await firstDay.getAttribute('data-date')
    test.skip(!startIso, 'data-date заезда')
    await firstDay.click()
    const endIso = addListingDays(startIso, 3)
    const checkoutBtn = datePickerDialog.locator(`button[data-date="${endIso}"]`)
    await expect(checkoutBtn).toBeVisible({ timeout: 15_000 })
    await checkoutBtn.click()
    await page.keyboard.press('Escape')
    await expect(datePickerDialog).toBeHidden({ timeout: 15_000 })

    const totalLoc = desktopBookingCard.getByTestId('booking-price-total')
    await expect(totalLoc).toBeVisible({ timeout: 20_000 })

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

      await assertApprox(api, baseURL!, sub + fee, total, `${code} subtotal+fee vs total`)

      const perNightRaw = await heroPriceEl.getAttribute('data-test-raw-value')
      const pn = parseRawAmount(perNightRaw)
      if (Number.isFinite(pn) && pn > 0) {
        await assertApprox(
          api,
          baseURL!,
          pn * 3 + fee,
          total,
          `${code} (цена за суток × 3) + сбор vs итог`,
          Math.max(2, total * 0.02),
        )
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
        await assertApprox(
          api,
          baseURL!,
          subThb - payThb,
          feeThb,
          'THB (канон) субтотал − выплата партнёру = комиссия/сбор',
          0.01,
        )
      }
    }
  })
})
