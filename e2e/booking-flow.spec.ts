import { test, expect, request } from '@playwright/test'

function addListingDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function parseDisplayAmount(text: string): number {
  const cleaned = text.replace(/[฿$€£₽¥₮\s]/g, '').replace(/,/g, '')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : NaN
}

test.describe('Карточка транспорта (vehicles): сутки и валюта', () => {
  test('за сутки, 3 дня, пересчёт в USD', async ({ page, baseURL }) => {
    test.setTimeout(120_000)
    test.skip(!baseURL, 'Нужен baseURL')

    const api = await request.newContext({ baseURL })
    const listingsRes = await api.get('/api/v2/listings?category=vehicles&limit=10')
    expect(listingsRes.ok()).toBeTruthy()
    const listingsJson = await listingsRes.json()
    const rows = listingsJson.data as Array<{
      id: string
      category?: { slug?: string }
      basePriceThb?: number
    }>
    const vehicle = rows?.[0]
    test.skip(!vehicle?.id, 'Нет активного листинга category=vehicles — пропуск (заполните каталог)')

    const ratesRes = await api.get('/api/v2/exchange-rates')
    expect(ratesRes.ok()).toBeTruthy()
    const ratesJson = await ratesRes.json()
    const rateMap = ratesJson.rateMap as Record<string, number>
    const usdPerThb = rateMap?.USD
    test.skip(
      !usdPerThb || !Number.isFinite(usdPerThb) || usdPerThb <= 0,
      'Нет курса USD в exchange_rates — пропуск',
    )

    await page.setViewportSize({ width: 1280, height: 900 })
    const calPromise = page.waitForResponse(
      (r) =>
        r.url().includes(`/api/v2/listings/${vehicle.id}/calendar`) && r.ok(),
      { timeout: 90_000 },
    )
    await page.goto(`/listings/${vehicle.id}`, { waitUntil: 'domcontentloaded' })
    await calPromise

    const periodLabel = page.getByTestId('booking-per-period-label')
    await expect(periodLabel).toBeVisible({ timeout: 20_000 })
    await expect(periodLabel).toContainText(/сутк/i)

    const firstDay = page.locator('button[data-clickable="true"]').first()
    await expect(firstDay).toBeVisible({ timeout: 20_000 })
    const startIso = await firstDay.getAttribute('data-date')
    test.skip(!startIso, 'Нет доступной даты заезда в календаре')

    await firstDay.click()
    const endIso = addListingDays(startIso, 3)
    const checkoutBtn = page.locator(`button[data-date="${endIso}"]`)
    await expect(checkoutBtn).toBeVisible({ timeout: 10_000 })
    await checkoutBtn.click()

    const totalLoc = page.getByTestId('booking-price-total')
    await expect(totalLoc).toBeVisible({ timeout: 15_000 })
    const thbText = await totalLoc.textContent()
    const thbDisplay = parseDisplayAmount(thbText || '')
    expect(thbDisplay).toBeGreaterThan(0)

    const base = Number(vehicle.basePriceThb) || 0
    if (base > 0) {
      expect(thbDisplay, 'итог THB соразмерен базе×3 с допуском на сервисный сбор').toBeGreaterThanOrEqual(
        base * 2,
      )
      expect(thbDisplay).toBeLessThanOrEqual(base * 6 + 50_000)
    }

    await page.getByTestId('currency-selector').click()
    await page.getByTestId('currency-option-USD').click()

    await expect(totalLoc).toContainText(/\$/)
    const usdText = await totalLoc.textContent()
    const usdDisplay = parseDisplayAmount(usdText || '')
    expect(usdDisplay).toBeGreaterThan(0)

    const impliedRate = thbDisplay / usdDisplay
    const relDiff = Math.abs(impliedRate - usdPerThb) / usdPerThb
    expect(relDiff, 'THB/USD из виджета должны согласоваться с /api/v2/exchange-rates').toBeLessThan(0.08)

    await api.dispose()
  })
})
