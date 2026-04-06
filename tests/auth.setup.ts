/**
 * Сохраняет storageState для E2E RBAC (cookies сессии).
 * Надёжнее UI-модалки: прямой POST /api/v2/auth/login (тот же путь, что и клиент).
 *
 * Переопределение: E2E_*_EMAIL, E2E_PASSWORD.
 * Файлы `playwright/.auth/*.json` не коммитить.
 */
import { test as setup, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { E2E_EMAILS, E2E_PASSWORD, E2E_ROUTES } from './e2e/constants'

const AUTH_DIR = path.join(process.cwd(), 'playwright', '.auth')

const CREDENTIALS = E2E_EMAILS

/**
 * Админ-лейаут (`app/admin/layout.js`) пускает только при `localStorage.gostaylo_user`
 * с ролью ADMIN/MODERATOR; одних HttpOnly-cookies недостаточно. Дублируем пользователя
 * из GET /api/v2/auth/me в storageState.origins[].localStorage (как делает клиент).
 */
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

async function loginViaApi(
  request: import('@playwright/test').APIRequestContext,
  email: string,
  outFile: string,
  appOrigin: string,
) {
  fs.mkdirSync(AUTH_DIR, { recursive: true })
  const res = await request.post(E2E_ROUTES.authLogin, {
    data: {
      email: email.toLowerCase().trim(),
      password: E2E_PASSWORD,
    },
  })
  const body = await res.json().catch(() => ({}))
  expect(res.ok(), `login ${email} → HTTP ${res.status()} ${JSON.stringify(body).slice(0, 300)}`).toBeTruthy()
  expect(body?.success, `login success=false for ${email}`).toBeTruthy()
  await request.storageState({ path: outFile })

  const me = await request.get(E2E_ROUTES.authMe)
  expect(me.ok(), `auth/me after login ${email}`).toBeTruthy()
  const meJson = (await me.json()) as { user?: Record<string, unknown> }
  const user = meJson?.user
  expect(user?.id, `auth/me user.id for ${email}`).toBeTruthy()
  mergeGostayloUserIntoStorageState(outFile, appOrigin, user!)
}

setup('authenticate admin', async ({ request, baseURL }) => {
  setup.skip(!baseURL, 'baseURL')
  await loginViaApi(request, CREDENTIALS.admin, path.join(AUTH_DIR, 'admin.json'), baseURL)
})

setup('authenticate partner', async ({ request, baseURL }) => {
  setup.skip(!baseURL, 'baseURL')
  await loginViaApi(request, CREDENTIALS.partner, path.join(AUTH_DIR, 'partner.json'), baseURL)
})

setup('authenticate renter (user)', async ({ request, baseURL }) => {
  setup.skip(!baseURL, 'baseURL')
  await loginViaApi(request, CREDENTIALS.renter, path.join(AUTH_DIR, 'user.json'), baseURL)
})
