/**
 * Production smoke: https://gostaylo.com (или PRODUCTION_SMOKE_URL).
 * Включается только при RUN_PRODUCTION_SMOKE=1 — не бьём прод при обычном `npx playwright test`.
 *
 * Без фикстур internal/e2e (нет POST броней) — только чтение каталога и UI чата под E2E-партнёром.
 */
import { test, expect } from '@playwright/test'
import { E2E_EMAILS, E2E_PASSWORD, E2E_ROUTES, E2E_STRINGS } from './constants'

test.describe('@production-smoke', () => {
  test('API: логин и сессия (E2E partner)', async ({ request, baseURL }) => {
    test.skip(!baseURL, 'baseURL')
    const res = await request.post(E2E_ROUTES.authLogin, {
      data: {
        email: E2E_EMAILS.partner.toLowerCase().trim(),
        password: E2E_PASSWORD,
      },
    })
    expect(res.ok(), `login HTTP ${res.status()}`).toBeTruthy()
    const body = (await res.json().catch(() => ({}))) as { success?: boolean }
    expect(body.success).toBeTruthy()
    const me = await request.get(E2E_ROUTES.authMe)
    expect(me.ok()).toBeTruthy()
    const meJson = (await me.json()) as { user?: { role?: string } }
    expect(meJson?.user?.role).toBeTruthy()
  })

  test('Каталог: карточка листинга (read-only)', async ({ page, baseURL, request }) => {
    test.skip(!baseURL, 'baseURL')
    const listingId = process.env.E2E_PRODUCTION_LISTING_ID?.trim()
    if (listingId) {
      await page.goto(`${baseURL}/listings/${listingId}`, { waitUntil: 'domcontentloaded' })
      await expect(page.locator('main')).toBeVisible({ timeout: 30_000 })
      return
    }
    const lr = await request.get(
      `${baseURL}/api/v2/listings?category=${E2E_STRINGS.bikeCategory}&limit=30&status=ACTIVE`,
    )
    expect(lr.ok()).toBeTruthy()
    const lj = await lr.json()
    const data = (lj?.data || []) as Array<{ id: string; title?: string }>
    const bike =
      data.find((x) => E2E_STRINGS.bikeTitleRegex.test(String(x.title || ''))) || data[0]
    test.skip(!bike?.id, 'Нет активного vehicle в каталоге')
    await page.goto(`${baseURL}/listings/${bike.id}`, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main')).toBeVisible({ timeout: 30_000 })
    await expect(
      page.getByRole('button', { name: /Забронировать|Book now|จอง/i }),
    ).toBeVisible({ timeout: 25_000 })
  })

  test('Чат: инбокс открывается (без фикстур брони)', async ({ page, baseURL }) => {
    test.skip(!baseURL, 'baseURL')
    await page.goto(`${baseURL}/messages/`, { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/messages/, { timeout: 30_000 })
    await expect(page).not.toHaveURL(/\/login/i)
    // Hall: ссылка «Архив» из ConversationList (залогиненный E2E partner)
    await expect(page.getByRole('link', { name: /Архив|Archive/i })).toBeVisible({ timeout: 45_000 })
  })

  test('Главная: заголовок и навигация', async ({ page, baseURL }) => {
    test.skip(!baseURL, 'baseURL')
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveTitle(/Gostaylo/i, { timeout: 20_000 })
  })
})
