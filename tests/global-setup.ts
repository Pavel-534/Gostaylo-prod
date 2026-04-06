/**
 * Выполняется один раз перед всеми проектами Playwright.
 * Дублирует подхват .env (на случай отдельного процесса) и печатает статус секрета фикстур.
 */
import path from 'path'
import { loadEnvConfig } from '@next/env'
import { seedE2eTourListingIfNeeded } from './e2e/seed-e2e-tour'
import { E2E_FIXTURE_SECRET } from './e2e/constants'

export default async function globalSetup() {
  loadEnvConfig(path.resolve(process.cwd()))
  console.log(`[Playwright] E2E_FIXTURE_SECRET: ${E2E_FIXTURE_SECRET ? 'LOADED' : 'MISSING'}`)
  if (E2E_FIXTURE_SECRET) {
    try {
      await seedE2eTourListingIfNeeded()
    } catch (e) {
      console.warn('[Playwright] E2E tours seed error:', e)
    }
  }
}
