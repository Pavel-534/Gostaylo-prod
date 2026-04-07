/**
 * Polyglot UX Bot — тайский и китайский: CTA листинга и чекаута без overflow и «сырых» ключей i18n.
 */
import { test, expect } from '@playwright/test'
import { addListingDays } from '../helpers/vehicle-calendar-range'

function setLang(page: import('@playwright/test').Page, code: string) {
  return page.evaluate((c) => {
    try {
      localStorage.setItem('gostaylo_language', c)
      window.dispatchEvent(new CustomEvent('language-change', { detail: c }))
    } catch {
      /* ignore */
    }
  }, code)
}

async function assertNoHorizontalOverflow(loc: import('@playwright/test').Locator) {
  await expect(loc).toBeVisible()
  const overflows = await loc.evaluate((el) => el.scrollWidth > el.clientWidth + 2)
  expect(overflows, 'horizontal overflow').toBeFalsy()
}

async function assertNoRawI18nArtifacts(page: import('@playwright/test').Page, root: string) {
  const box = page.locator(root).first()
  await expect(box).toBeVisible({ timeout: 20_000 })
  const t = (await box.innerText().catch(() => '')) || ''
  expect(t).not.toMatch(/\.not_found/i)
  expect(t).not.toMatch(/translation\./i)
}

test.describe('@polyglot-ux-bot', () => {
  test('листинг: TH / ZH — «Забронировать» без overflow', async ({ page, baseURL }) => {
    test.setTimeout(180_000)
    test.skip(!baseURL, 'baseURL')

    const listingsRes = await page.request.get(`${baseURL}/api/v2/listings?category=vehicles&limit=24`)
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
    const availabilityP = page.waitForResponse(
      (r) => {
        const u = r.url()
        if (r.request().method() !== 'GET' || !r.ok()) return false
        return (
          u.includes(`/api/v2/listings/${vehicle.id}/availability`) && u.includes('startDate=')
        )
      },
      { timeout: 90_000 },
    )
    await checkoutBtn.click()
    await availabilityP
    await page.keyboard.press('Escape')
    await expect(datePickerDialog).toBeHidden({ timeout: 15_000 })

    const bookDesktop = desktopBookingCard.getByTestId('listing-book-now')
    await expect
      .poll(async () => bookDesktop.isEnabled(), { timeout: 90_000, intervals: [400, 800, 1200] })
      .toBeTruthy()

    for (const lang of ['th', 'zh'] as const) {
      await setLang(page, lang)
      await expect
        .poll(async () => page.evaluate(() => document.documentElement.getAttribute('lang') || ''), {
          timeout: 10_000,
        })
        .toBe(lang)
      await assertNoRawI18nArtifacts(page, 'main')
      const book = desktopBookingCard.getByTestId('listing-book-now')
      await expect(book).toBeEnabled({ timeout: 25_000 })
      await assertNoHorizontalOverflow(book)
    }
  })

  test('чекаут: TH / ZH — «Оплатить» без overflow (существующая PENDING-бронь)', async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(90_000)
    test.skip(!baseURL, 'baseURL')

    const meRes = await page.request.get(`${baseURL}/api/v2/auth/me`)
    test.skip(!meRes.ok(), 'auth /me')
    const me = (await meRes.json()) as { success?: boolean; user?: { id?: string } }
    const uid = me?.success && me?.user?.id ? me.user.id : null
    test.skip(!uid, 'renter id')

    const listRes = await page.request.get(
      `${baseURL}/api/v2/bookings?renterId=${encodeURIComponent(uid)}&limit=40`,
    )
    expect(listRes.ok()).toBeTruthy()
    const listJson = (await listRes.json()) as {
      data?: Array<{ id?: string; status?: string }>
    }
    const rows = listJson?.data || []
    const pending = rows.find((b) =>
      ['PENDING', 'AWAITING_PAYMENT', 'CONFIRMED'].includes(String(b?.status || '')),
    )
    test.skip(!pending?.id, 'нет брони для чекаута у тестового рентера')

    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`${baseURL}/checkout/${pending.id}`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('checkout-pay-submit')).toBeVisible({ timeout: 45_000 })

    for (const lang of ['th', 'zh'] as const) {
      await setLang(page, lang)
      await expect
        .poll(async () => page.evaluate(() => document.documentElement.getAttribute('lang') || ''), {
          timeout: 10_000,
        })
        .toBe(lang)
      await assertNoRawI18nArtifacts(page, 'main')
      const pay = page.getByTestId('checkout-pay-submit')
      await expect(pay).toBeEnabled()
      await assertNoHorizontalOverflow(pay)
    }
  })
})
