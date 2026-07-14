import { test, expect } from '@playwright/test'
import { e2eSiteTitleRegex } from './e2e/constants'
test('Главная страница содержит заголовок бренда и доступен скриншот', async ({ page, baseURL }) => {
  test.skip(!baseURL, 'baseURL')
  await page.goto(baseURL)
  await expect(page).toHaveTitle(e2eSiteTitleRegex())
  await page.screenshot({ path: 'homepage-screenshot.png', fullPage: true })

  await page.getByRole('button', { name: /Войти|Login|Sign in/i }).first().click()
  await expect(page.locator('#auth-email')).toBeVisible({ timeout: 15_000 })
})
