import { test, expect, request } from '@playwright/test'

function addListingDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function parseDisplayAmount(text: string): number {
  let s = text.replace(/[฿$€£₽¥₮\s]/g, '').trim()
  // ru-RU (and similar): decimal comma — e.g. $47,77 or 1.234,56
  if (/^\d{1,3}(\.\d{3})*,\d{1,2}$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (/^\d+,\d{1,2}$/.test(s)) {
    s = s.replace(',', '.')
  } else {
    s = s.replace(/,/g, '')
  }
  const n = parseFloat(s)
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
    const ratesUiPromise = page.waitForResponse(
      (r) =>
        r.url().includes('/api/v2/exchange-rates') &&
        r.request().method() === 'GET' &&
        r.ok(),
      { timeout: 90_000 },
    )
    await page.goto(`/listings/${vehicle.id}`, { waitUntil: 'domcontentloaded' })
    await ratesUiPromise
    const calResponse = await calResponsePromise

    if (!calResponse.ok()) {
      const body = await calResponse.text().catch(() => '')
      throw new Error(
        `Calendar API HTTP ${calResponse.status()} for listing ${vehicle.id}: ${body.slice(0, 500)}`,
      )
    }

    const calJson = (await calResponse.json()) as {
      success?: boolean
      error?: string
      data?: { calendar?: Array<{ date?: string; can_check_in?: boolean }> }
    }
    if (!calJson?.success) {
      throw new Error(
        `Calendar API success=false for listing ${vehicle.id}: ${calJson?.error ?? JSON.stringify(calJson).slice(0, 400)}`,
      )
    }
    const calRows = calJson?.data?.calendar
    if (!Array.isArray(calRows)) {
      throw new Error(`Calendar API: missing data.calendar[] for listing ${vehicle.id}`)
    }
    const checkInDays = calRows.filter((d) => d?.can_check_in === true)
    test.skip(
      checkInDays.length === 0,
      `Листинг ${vehicle.id}: в ответе календаря нет дней с can_check_in (всего ${calRows.length} дней). Проверьте доступность и вместимость.`,
    )

    // Два GostayloCalendar на странице (мобильный в lg:hidden всё ещё в DOM) — только десктопный sticky-виджет.
    const desktopBookingCard = page.locator('div.hidden.lg\\:block.sticky.top-24')

    const periodLabel = desktopBookingCard.getByTestId('booking-per-period-label')
    await expect(periodLabel).toBeVisible({ timeout: 20_000 })
    await expect(periodLabel).toContainText(/сутк/i)
    const calendarTrigger = desktopBookingCard.getByTestId('gostaylo-calendar-trigger')
    await expect(calendarTrigger).toBeVisible({ timeout: 20_000 })
    await expect(calendarTrigger).toBeEnabled({ timeout: 20_000 })
    await calendarTrigger.click()

    const datePickerDialog = page.getByRole('dialog')
    await expect(datePickerDialog).toBeVisible({ timeout: 15_000 })

    const firstDay = datePickerDialog.locator('button[data-clickable="true"]').first()
    await expect(
      firstDay,
      'Нет кликабельного дня заезда в календаре после открытия датапикера (API вернул can_check_in>0 — проверьте отрисовку / гостей).',
    ).toBeVisible({ timeout: 25_000 })
    const startIso = await firstDay.getAttribute('data-date')
    if (!startIso) {
      throw new Error(
        `Первая кликабельная ячейка календаря без data-date (листинг ${vehicle.id}).`,
      )
    }

    await firstDay.click()
    const endIso = addListingDays(startIso, 3)
    const checkoutBtn = datePickerDialog.locator(`button[data-date="${endIso}"]`)
    await expect(
      checkoutBtn,
      `Не найдена дата выезда ${endIso} в календаре (диапазон +3 дня от ${startIso}).`,
    ).toBeVisible({ timeout: 15_000 })
    await checkoutBtn.click()

    const totalLoc = desktopBookingCard.getByTestId('booking-price-total')
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
