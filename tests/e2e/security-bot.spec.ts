/**
 * Security Bot — гость не должен видеть админку (редирект на /login).
 */
import { test, expect } from '@playwright/test'

test.describe('@security-bot', () => {
  test('GET /admin без сессии → редирект на /login', async ({ page, baseURL }) => {
    test.skip(!baseURL, 'baseURL')
    await page.context().clearCookies()

    await page.goto(`${baseURL}/admin`, { waitUntil: 'domcontentloaded' })

    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 })
  })

  test('GET /admin/dashboard без сессии → редирект на /login', async ({ page, baseURL }) => {
    test.skip(!baseURL, 'baseURL')
    await page.context().clearCookies()

    await page.goto(`${baseURL}/admin/dashboard`, { waitUntil: 'domcontentloaded' })

    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 })
  })
})
