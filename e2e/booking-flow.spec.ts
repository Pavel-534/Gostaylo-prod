import { test, expect, request } from '@playwright/test'
import {
  getDesktopBookingCard,
  openPlatformCalendarPicker,
  selectPlatformCalendarRange,
  waitForBookingPriceTotal,
} from '../tests/e2e/helpers/platform-calendar-picker'
import { findFirstValidCalendarSpan } from '../tests/e2e/helpers/vehicle-calendar-range'

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
    test.setTimeout(180_000)
    test.skip(!baseURL, 'Нужен baseURL')

    const api = await request.newContext({ baseURL })
    const listingsRes = await api.get('/api/v2/search?category=vehicles&limit=10')
    expect(listingsRes.ok()).toBeTruthy()
    const listingsJson = await listingsRes.json()
    const rows = listingsJson.data?.listings as Array<{
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

    // Stage 171.41 — prefer explicit calendar probe (RSC dehydrate may skip client /calendar GET)
    const calProbe = await api.get(`/api/v2/listings/${vehicle.id}/calendar?days=180`)
    expect(calProbe.ok(), `Calendar API HTTP ${calProbe.status()}`).toBeTruthy()
    const calJson = (await calProbe.json()) as {
      success?: boolean
      error?: string
      data?: { calendar?: Array<{ date?: string; can_check_in?: boolean; status?: string; is_transition?: boolean }> }
    }
    expect(calJson?.success, calJson?.error || 'calendar success=false').toBeTruthy()
    const calRows = calJson?.data?.calendar
    if (!Array.isArray(calRows)) {
      throw new Error(`Calendar API: missing data.calendar[] for listing ${vehicle.id}`)
    }
    const checkInDays = calRows.filter((d) => d?.can_check_in === true)
    test.skip(
      checkInDays.length === 0,
      `Листинг ${vehicle.id}: в ответе календаря нет дней с can_check_in (всего ${calRows.length} дней). Проверьте доступность и вместимость.`,
    )

    const span = findFirstValidCalendarSpan(calRows, 3)
    test.skip(!span, `Листинг ${vehicle.id}: нет окна can_check_in + 3 суток в календаре`)

    await page.goto(`/listings/${vehicle.id}`, { waitUntil: 'domcontentloaded' })

    // Два PlatformCalendar на странице (мобильный в lg:hidden всё ещё в DOM) — только десктопный sticky-виджет.
    const desktopBookingCard = getDesktopBookingCard(page)
    await expect(desktopBookingCard.getByTestId('platform-calendar-trigger')).toBeVisible({
      timeout: 45_000,
    })

    const periodLabel = desktopBookingCard.getByTestId('booking-per-period-label')
    await expect(periodLabel).toBeVisible({ timeout: 20_000 })
    await expect(periodLabel).toContainText(/сутк/i)

    const picker = await openPlatformCalendarPicker(page, desktopBookingCard)
    await selectPlatformCalendarRange(picker, 3, {
      page,
      listingId: vehicle.id,
      desktopBookingCard,
      knownStartIso: span!.startIso,
      knownEndIso: span!.endIso,
    })

    const totalLoc = await waitForBookingPriceTotal(desktopBookingCard)
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
