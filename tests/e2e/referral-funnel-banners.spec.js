/**
 * Stage 143 — referral funnel banners on catalog (pending ref cookie).
 */
import { test, expect } from '@playwright/test'

test.describe('@referral-funnel-banners', () => {
  test('catalog shows bonus saved banner when pending ref cookie is set', async ({ page, context, baseURL }) => {
    test.skip(!baseURL, 'baseURL required')

    const host = new URL(baseURL).hostname
    await context.addCookies([
      {
        name: 'gostaylo_pending_ref',
        value: 'STAGE143TEST',
        domain: host,
        path: '/',
        sameSite: 'Lax',
      },
    ])

    await page.goto(`${baseURL}/listings`)
    await expect(
      page.getByText(/Бонус сохранён|Bonus saved/i).first(),
    ).toBeVisible({ timeout: 15_000 })
  })
})
