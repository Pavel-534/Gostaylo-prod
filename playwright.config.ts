import { defineConfig, devices } from '@playwright/test'

const AUTH = {
  admin: 'playwright/.auth/admin.json',
  partner: 'playwright/.auth/partner.json',
  user: 'playwright/.auth/user.json',
} as const

/**
 * E2E: `e2e/` (бронирование, валюты).
 * RBAC: `tests/e2e/role-access.spec.ts` + `tests/auth.setup.ts` → `playwright/.auth/*.json`.
 * Legacy smoke: `tests/example.spec.ts`.
 *
 * `npx playwright test` — все проекты; только RBAC: `npx playwright test --project rbac-partner --project rbac-admin --project rbac-renter`
 *
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
      name: 'setup',
      testDir: './tests',
      testMatch: '**/auth.setup.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'rbac-partner',
      dependencies: ['setup'],
      testDir: './tests/e2e',
      testMatch: '**/role-access.spec.ts',
      grep: /@partner/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH.partner,
      },
    },
    {
      name: 'rbac-admin',
      dependencies: ['setup'],
      testDir: './tests/e2e',
      testMatch: '**/role-access.spec.ts',
      grep: /@admin/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH.admin,
      },
    },
    {
      name: 'rbac-renter',
      dependencies: ['setup'],
      testDir: './tests/e2e',
      testMatch: '**/role-access.spec.ts',
      grep: /@renter/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH.user,
      },
    },
    {
      name: 'e2e-chromium',
      testDir: './e2e',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'smoke-chromium',
      testDir: './tests',
      testMatch: '**/example.spec.ts',
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
