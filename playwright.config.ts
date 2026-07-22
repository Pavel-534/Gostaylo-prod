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
const E2E_HEADERS =
  process.env.E2E_FIXTURE_SECRET
    ? { 'x-e2e-test-mode': '1' }
    : undefined

const PRODUCTION_SMOKE_URL =
  process.env.PRODUCTION_SMOKE_URL || 'https://airento.ru'

/** Прод-smoke не входит в обычный прогон — только при RUN_PRODUCTION_SMOKE=1. */
const productionSmokeProjects =
  process.env.RUN_PRODUCTION_SMOKE === '1'
    ? [
        {
          name: 'setup-production-smoke',
          testDir: './tests',
          testMatch: '**/auth.setup.production-smoke.ts',
          use: {
            ...devices['Desktop Chrome'],
            baseURL: PRODUCTION_SMOKE_URL,
          },
        },
        {
          name: 'production-smoke',
          dependencies: ['setup-production-smoke'],
          testDir: './tests/e2e',
          testMatch: '**/production-smoke.spec.ts',
          use: {
            ...devices['Desktop Chrome'],
            baseURL: PRODUCTION_SMOKE_URL,
            storageState: 'playwright/.auth/production-smoke-partner.json',
            /** Не слать x-e2e-test-mode на прод — поведение как у реальных пользователей */
            extraHTTPHeaders: {},
          },
        },
      ]
    : []

/**
 * E2E: `e2e/` (бронирование, валюты).
 * RBAC: `tests/e2e/role-access.spec.ts` + `tests/auth.setup.ts` → `playwright/.auth/*.json`.
 * Legacy smoke: `tests/example.spec.ts`.
 * SEO Spy Bot: `tests/e2e/seo-spy-bot.spec.ts` — проект `seo-spy-bot`.
 * Accountant Bot: `tests/e2e/bots/accountant-math.spec.ts` — проект `accountant-bot`.
 * Polyglot UX Bot: `tests/e2e/bots/polyglot-ux.spec.ts` — проект `polyglot-bot` (renter storage).
 * Chat Controller Bot: `tests/e2e/bots/chat-control.spec.ts` — проект `chat-control-bot`.
 * Guest golden path: `tests/e2e/guest-inquiry-golden-path.spec.ts` — проект `guest-inquiry-golden-path`.
 * CRO funnel smoke (191.1): `tests/e2e/cro-funnel-smoke.spec.ts` — проект `cro-funnel-smoke` (presentation-only).
 * Chat invoice golden path: `tests/e2e/chat-invoice-payment-golden-path.spec.ts` — проект `chat-invoice-payment-golden-path`.
 * Stage 133 referral dashboard visual: `tests/e2e/referral-dashboard-visual.spec.js` — проект `referral-dashboard-visual` (fixture + snapshots).
 * Security Bot: `tests/e2e/security-bot.spec.ts` — проект `security-bot` (без storageState).
 * Stage 9 API Guard: `tests/e2e/stage9-api-guard.spec.ts` — проект `stage9-api-guard` (depends on setup).
 * Stage 12 Escrow Regression: `tests/e2e/stage12-escrow-regression.spec.ts` — проект `stage12-escrow-regression`.
 * Speed Bot: `tests/e2e/speed-bot.spec.ts` — проект `speed-bot`.
 * Discovery analytics (169.0): `tests/e2e/discovery-analytics.spec.ts` — проект `discovery-analytics` (`npm run test:discovery-analytics`).
 *
 * `npx playwright test` — все проекты; RBAC: `--project rbac-*`; чат: `--project chat-mobile-iphone --project chat-mobile-pixel --project chat-stress`
 *
 * **Production smoke:** `RUN_PRODUCTION_SMOKE=1 npx playwright test --project=setup-production-smoke --project=production-smoke` (опц. `PRODUCTION_SMOKE_URL=…`). Teardown при этом отключён.
 *
 * BASE_URL / PLAYWRIGHT_BASE_URL — origin приложения (по умолчанию localhost:3000).
 * Mobile-chat с авто-бронью: **`E2E_FIXTURE_SECRET`** в `.env.local` или `.env` (подхватывается через `loadEnvConfig` выше), либо в shell при `npx playwright test`.
 */
export default defineConfig({
  globalSetup: './tests/global-setup.ts',
  globalTeardown: './tests/global-teardown.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],
  timeout: 90_000,
  /** Stage 133 visual — единый baseline без суффикса OS (только referral-dashboard-visual). */
  snapshotPathTemplate: '{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}-{projectName}{ext}',
  use: {
    /** По умолчанию локальный dev-сервер; переопределение: PLAYWRIGHT_BASE_URL или BASE_URL */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    locale: 'ru-RU',
    ...(E2E_HEADERS ? { extraHTTPHeaders: E2E_HEADERS } : {}),
  },
  projects: [
    {
      name: 'setup',
      testDir: './tests',
      testMatch: '**/auth.setup.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'partner-calendar-flow',
      dependencies: ['setup'],
      testDir: './tests/e2e',
      testMatch: '**/partner-calendar-flow.spec.ts',
      timeout: 180_000,
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH.partner,
      },
    },
    {
      name: 'ambassador-currency-isolation',
      dependencies: ['setup'],
      testDir: './tests/e2e',
      testMatch: '**/ambassador-currency-isolation.spec.ts',
      timeout: 120_000,
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH.user,
      },
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
      name: 'stage9-api-guard',
      dependencies: ['setup'],
      testDir: './tests/e2e',
      testMatch: '**/stage9-api-guard.spec.ts',
      timeout: 180_000,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'stage12-escrow-regression',
      dependencies: ['setup'],
      testDir: './tests/e2e',
      testMatch: '**/stage12-escrow-regression.spec.ts',
      timeout: 180_000,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'guest-inquiry-golden-path',
      dependencies: ['setup'],
      testDir: './tests/e2e',
      testMatch: '**/guest-inquiry-golden-path.spec.ts',
      timeout: 240_000,
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH.user,
      },
    },
    {
      name: 'chat-invoice-payment-golden-path',
      dependencies: ['setup'],
      testDir: './tests/e2e',
      testMatch: '**/chat-invoice-payment-golden-path.spec.ts',
      timeout: 300_000,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'checkout-mock-smoke',
      dependencies: ['setup'],
      testDir: './tests/e2e',
      testMatch: '**/checkout-mock-smoke.spec.ts',
      timeout: 120_000,
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH.user,
      },
    },
    {
      name: 'cro-funnel-smoke',
      testDir: './tests/e2e',
      testMatch: '**/cro-funnel-smoke.spec.ts',
      timeout: 120_000,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'discovery-analytics',
      testDir: './tests/e2e',
      testMatch: '**/discovery-analytics.spec.ts',
      timeout: 120_000,
      workers: 1,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'security-bot',
      testDir: './tests/e2e',
      testMatch: '**/security-bot.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        storageState: { cookies: [], origins: [] },
      },
    },
    {
      name: 'speed-bot',
      testDir: './tests/e2e',
      testMatch: '**/speed-bot.spec.ts',
      timeout: 180_000,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'seo-spy-bot',
      testDir: './tests/e2e',
      testMatch: '**/seo-spy-bot.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'accountant-bot',
      testDir: './tests/e2e',
      testMatch: '**/bots/accountant-math.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'polyglot-bot',
      dependencies: ['setup'],
      testDir: './tests/e2e',
      testMatch: '**/bots/polyglot-ux.spec.ts',
      timeout: 180_000,
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH.user,
      },
    },
    {
      name: 'chat-control-bot',
      dependencies: ['setup'],
      testDir: './tests/e2e',
      testMatch: '**/bots/chat-control.spec.ts',
      timeout: 180_000,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chat-mobile-iphone',
      dependencies: ['setup'],
      testDir: './tests/e2e',
      testMatch: '**/mobile-chat.spec.ts',
      timeout: 120_000,
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
    {
      name: 'chat-sync',
      dependencies: ['setup'],
      testDir: './tests/e2e',
      testMatch: '**/chat-sync.spec.ts',
      timeout: 180_000,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'stage72-referral-cashflow',
      testDir: './tests/e2e',
      testMatch: '**/stage72-referral-cashflow.spec.ts',
      timeout: 180_000,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'referral-dashboard-visual',
      testDir: './tests/e2e',
      testMatch: '**/referral-dashboard-visual.spec.js',
      timeout: 180_000,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
      expect: {
        toHaveScreenshot: {
          animations: 'disabled',
          maxDiffPixelRatio: 0.025,
        },
      },
    },
    ...productionSmokeProjects,
  ],
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          ...process.env,
          E2E_TEST_RUN: '1',
        },
      },
})
