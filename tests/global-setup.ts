/**
 * Выполняется один раз перед всеми проектами Playwright.
 * Дублирует подхват .env (на случай отдельного процесса) и печатает статус секрета фикстур.
 */
import path from 'path'
import { loadEnvConfig } from '@next/env'

export default async function globalSetup() {
  loadEnvConfig(path.resolve(process.cwd()))
  const secret = (process.env.E2E_FIXTURE_SECRET || '').trim()
  console.log(`[Playwright] E2E_FIXTURE_SECRET: ${secret ? 'LOADED' : 'MISSING'}`)
}
