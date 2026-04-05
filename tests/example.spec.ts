import { test, expect } from '@playwright/test'

test('Главная страница содержит заголовок Gostaylo и доступен скриншот', async ({ page, baseURL }) => {
  test.skip(!baseURL, 'baseURL')
  await page.goto(baseURL)
  await expect(page).toHaveTitle(/Gostaylo/i)
  await page.screenshot({ path: 'homepage-screenshot.png', fullPage: true })

  await page.getByRole('button', { name: /Войти|Login|Sign in/i }).first().click()
  await expect(page.locator('#auth-email')).toBeVisible({ timeout: 15_000 })
})
