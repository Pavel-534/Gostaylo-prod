/**
 * Выполняется один раз перед всеми проектами Playwright.
 * Дублирует подхват .env (на случай отдельного процесса) и печатает статус секрета фикстур.
 */
import fs from 'fs'
import path from 'path'
import { loadEnvConfig } from '@next/env'
import { seedE2eTourListingIfNeeded } from './e2e/seed-e2e-tour'
import { E2E_FIXTURE_SECRET } from './e2e/constants'
import { buildCookieConsentStorageStateForOrigin } from './e2e/helpers/cookie-consent-e2e'

const COOKIE_CONSENT_AUTH = path.join(process.cwd(), 'playwright', '.auth', 'cookie-consent.json')

export default async function globalSetup() {
  loadEnvConfig(path.resolve(process.cwd()))
  const baseURL =
    process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || 'http://localhost:3000'
  try {
    fs.mkdirSync(path.dirname(COOKIE_CONSENT_AUTH), { recursive: true })
    fs.writeFileSync(
      COOKIE_CONSENT_AUTH,
      JSON.stringify(buildCookieConsentStorageStateForOrigin(baseURL)),
    )
  } catch (e) {
    console.warn('[Playwright] cookie-consent storageState seed failed:', e)
  }
  console.log(`[Playwright] E2E_FIXTURE_SECRET: ${E2E_FIXTURE_SECRET ? 'LOADED' : 'MISSING'}`)
  if (E2E_FIXTURE_SECRET) {
    try {
      await seedE2eTourListingIfNeeded()
    } catch (e) {
      console.warn('[Playwright] E2E tours seed error:', e)
    }
  }
}
