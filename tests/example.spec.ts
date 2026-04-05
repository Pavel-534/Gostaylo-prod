import { test, expect } from '@playwright/test';

test('Главная страница содержит заголовок Gostaylo и доступен скриншот', async ({ page }) => {
  const url = process.env.BASE_URL || 'http://gostaylo.com';
  await page.goto(url);

  await expect(page).toHaveTitle(/Gostaylo/i);

  await page.screenshot({ path: 'homepage-screenshot.png', fullPage: true });
  await page.click('button:has-text("Login")');
  await expect(page.locator('form')).toBeVisible();
});