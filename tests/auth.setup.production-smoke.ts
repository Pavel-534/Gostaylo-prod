/**
 * Сессия E2E-партнёра на прод-домене для `production-smoke`.
 * Запускается только при RUN_PRODUCTION_SMOKE=1 (см. playwright.config.ts).
 * Файл `playwright/.auth/production-smoke-partner.json` в .gitignore (как и прочие .auth/*.json).
 */
import { test as setup, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { E2E_EMAILS, E2E_PASSWORD, E2E_ROUTES } from './e2e/constants'

const AUTH_DIR = path.join(process.cwd(), 'playwright', '.auth')
const OUT = path.join(AUTH_DIR, 'production-smoke-partner.json')

function mergeGostayloUserIntoStorageState(
  outFile: string,
  appOrigin: string,
  user: Record<string, unknown>,
) {
  const raw = fs.readFileSync(outFile, 'utf-8')
  const state = JSON.parse(raw) as {
    cookies?: unknown[]
    origins?: Array<{ origin: string; localStorage: Array<{ name: string; value: string }> }>
  }
  const origin = new URL(appOrigin).origin
  const value = JSON.stringify(user)
  state.origins = state.origins || []
  let entry = state.origins.find((o) => o.origin === origin)
  if (!entry) {
    entry = { origin, localStorage: [] }
    state.origins.push(entry)
  }
  entry.localStorage = entry.localStorage || []
  const i = entry.localStorage.findIndex((x) => x.name === 'gostaylo_user')
  if (i >= 0) entry.localStorage[i].value = value
  else entry.localStorage.push({ name: 'gostaylo_user', value })
  fs.writeFileSync(outFile, JSON.stringify(state))
}

setup('production-smoke: authenticate E2E partner', async ({ request, baseURL }) => {
  setup.skip(!baseURL, 'baseURL')
  fs.mkdirSync(AUTH_DIR, { recursive: true })
  const res = await request.post(E2E_ROUTES.authLogin, {
    data: {
      email: E2E_EMAILS.partner.toLowerCase().trim(),
      password: E2E_PASSWORD,
    },
  })
  const body = await res.json().catch(() => ({}))
  expect(
    res.ok(),
    `prod smoke login ${E2E_EMAILS.partner} → HTTP ${res.status()} ${JSON.stringify(body).slice(0, 300)}`,
  ).toBeTruthy()
  expect(body?.success, 'login success').toBeTruthy()
  await request.storageState({ path: OUT })

  const me = await request.get(E2E_ROUTES.authMe)
  expect(me.ok(), 'auth/me after login').toBeTruthy()
  const meJson = (await me.json()) as { user?: Record<string, unknown> }
  const user = meJson?.user
  expect(user?.id, 'auth/me user.id').toBeTruthy()
  mergeGostayloUserIntoStorageState(OUT, baseURL, user!)
})
