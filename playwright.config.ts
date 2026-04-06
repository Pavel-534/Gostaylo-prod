import path from 'path'
import { defineConfig, devices } from '@playwright/test'
import { loadEnvConfig } from '@next/env'

// Как у Next.js: подхватываем .env.local и .env (E2E_FIXTURE_SECRET, BASE_URL и т.д.)
loadEnvConfig(path.resolve(process.cwd()))

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
 * `npx playwright test` — все проекты; RBAC: `--project rbac-*`; чат: `--project chat-mobile-iphone --project chat-mobile-pixel --project chat-stress`
 *
 * BASE_URL / PLAYWRIGHT_BASE_URL — origin приложения (по умолчанию localhost:3000).
 * Mobile-chat с авто-бронью: **`E2E_FIXTURE_SECRET`** в `.env.local` или `.env` (подхватывается через `loadEnvConfig` выше), либо в shell при `npx playwright test`.
 */
export default defineConfig({
  globalSetup: './tests/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 90_000,
  use: {
    /** По умолчанию локальный dev-сервер; переопределение: PLAYWRIGHT_BASE_URL или BASE_URL */
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
    {
      name: 'chat-mobile-iphone',
      dependencies: ['setup'],
      testDir: './tests/e2e',
      testMatch: '**/mobile-chat.spec.ts',
      use: {
        ...devices['iPhone 14'],
        storageState: AUTH.partner,
      },
    },
    {
      name: 'chat-mobile-pixel',
      dependencies: ['setup'],
      testDir: './tests/e2e',
      testMatch: '**/mobile-chat.spec.ts',
      use: {
        ...devices['Pixel 7'],
        storageState: AUTH.partner,
      },
    },
    {
      name: 'chat-stress',
      dependencies: ['setup'],
      testDir: './tests/e2e',
      testMatch: '**/chat-stress.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH.partner,
      },
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
