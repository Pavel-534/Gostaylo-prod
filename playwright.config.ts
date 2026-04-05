import { defineConfig, devices } from '@playwright/test'

/**
 * E2E: `e2e/` (бронирование, валюты). Legacy smoke: `tests/`.
 * Запуск: `npx playwright test` или UI: `npx playwright test --ui`
 * BASE_URL / PLAYWRIGHT_BASE_URL — origin приложения (по умолчанию localhost:3000).
 */
export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 90_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    locale: 'ru-RU',
  },
  projects: [
    {
      name: 'e2e-chromium',
      testDir: './e2e',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'smoke-chromium',
      testDir: './tests',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
