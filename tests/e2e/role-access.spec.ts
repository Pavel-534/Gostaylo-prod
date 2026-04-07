/**
 * RBAC / multi-role: отдельные проекты Playwright подставляют нужный storageState
 * и отфильтровывают тесты по @partner | @admin | @renter.
 */
import { test, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { E2E_ROUTES, E2E_STRINGS, E2E_TEST_IDS } from './constants'

type AuthMeShape = { user?: { id?: string; role?: string } } | null

async function fetchAuthMeWithRetry(
  request: import('@playwright/test').APIRequestContext,
  baseURL: string,
  retries = 4,
): Promise<AuthMeShape> {
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await request.get(`${baseURL}${E2E_ROUTES.authMe}`, { failOnStatusCode: false })
      const ct = (r.headers()['content-type'] || '').toLowerCase()
      if (!r.ok() || !ct.includes('application/json')) {
        if (i < retries) {
          await new Promise((resolve) => setTimeout(resolve, 700 * (i + 1)))
          continue
        }
        return null
      }
      const j = (await r.json().catch(() => null)) as AuthMeShape
      if (j?.user) return j
    } catch {
      // retry
    }
    if (i < retries) {
      await new Promise((resolve) => setTimeout(resolve, 700 * (i + 1)))
    }
  }
  return null
}

async function getAuthUserId(
  request: import('@playwright/test').APIRequestContext,
  baseURL: string,
): Promise<string | null> {
  const j = await fetchAuthMeWithRetry(request, baseURL)
  return j?.user?.id ? String(j.user.id) : null
}

test.describe('Partner (кабинет партнёра)', () => {
  test('видит Объекты, Календарь, Финансы; открывает Honda PCX', { tag: '@partner' }, async ({
    page,
    baseURL,
    request,
  }) => {
    test.skip(!baseURL, 'baseURL')
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`${baseURL}/partner/dashboard`)
    await expect(page.getByRole('link', { name: 'Объекты' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('link', { name: 'Календарь' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Финансы' })).toBeVisible()

    const uid = await getAuthUserId(request, baseURL)
    test.skip(!uid, 'Нет сессии partner')
    const listRes = await request.get(`${baseURL}/api/v2/partner/listings?partnerId=${encodeURIComponent(uid)}`)
    expect(listRes.ok()).toBeTruthy()
    const listJson = await listRes.json()
    const rows = (listJson?.data || []) as Array<{ id: string; title?: string }>
    const bike = rows.find((l) => E2E_STRINGS.bikeTitleRegex.test(String(l.title || '')))
    test.skip(!bike?.id, 'Нет листинга Honda PCX у партнёра — пропуск')
    await page.goto(`${baseURL}/partner/listings/${bike.id}`)
    await expect(page.getByRole('heading', { name: /Редактирование|Edit listing/i })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.locator('body')).toContainText(/Honda|PCX/i)
  })

  test('тур: поля мин/макс группы на редактировании', { tag: '@partner' }, async ({
    page,
    baseURL,
    request,
  }) => {
    test.skip(!baseURL, 'baseURL')
    await page.setViewportSize({ width: 1280, height: 900 })
    const uid = await getAuthUserId(request, baseURL)
    test.skip(!uid, 'Нет сессии partner')
    const listRes = await request.get(`${baseURL}/api/v2/partner/listings?partnerId=${encodeURIComponent(uid)}`)
    const listJson = await listRes.json()
    const rows = (listJson?.data || []) as Array<{
      id: string
      category?: { slug?: string }
    }>
    const tour = rows.find((l) => String(l.category?.slug || '').toLowerCase() === E2E_STRINGS.toursSlug)
    test.skip(!tour?.id, 'Нет листинга категории tours у партнёра — пропуск')

    await page.goto(`${baseURL}/partner/listings/${tour.id}`)
    await expect(page.getByText(/Мин\.\s*групп|Min\.\s*group/i)).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/Макс\.\s*групп|Max\.\s*group/i)).toBeVisible()
  })

  test('скриншот: страница Финансы', { tag: '@partner' }, async ({ page, baseURL }) => {
    test.skip(!baseURL, 'baseURL')
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`${baseURL}/partner/finances`)
    await page.waitForLoadState('networkidle').catch(() => {})
    const buf = await page.screenshot({ fullPage: true })
    await test.info().attach('partner-finances', { body: buf, contentType: 'image/png' })
    const outDir = path.join(process.cwd(), 'test-results', 'audit')
    fs.mkdirSync(outDir, { recursive: true })
    await page.screenshot({ path: path.join(outDir, 'partner-finances.png'), fullPage: true })
  })
})

test.describe('Renter', () => {
  test('нет доступа к /partner и /admin', { tag: '@renter' }, async ({ page, baseURL, request }) => {
    test.skip(!baseURL, 'baseURL')
    const mj = await fetchAuthMeWithRetry(request, baseURL)
    const renterRole = mj?.user?.role
    expect(
      ['RENTER', 'USER'].includes(String(renterRole)),
      `Аккаунт E2E_RENTER: ожидалась роль RENTER или USER, получено ${renterRole}`,
    ).toBeTruthy()

    await page.setViewportSize({ width: 1280, height: 900 })
    // Edge middleware: роль RENTER не в allow-list для /partner → редирект на `/`, не экран партнёр-лейаута.
    await page.goto(`${baseURL}/partner/listings`, { waitUntil: 'domcontentloaded' })
    await expect(page).not.toHaveURL(/\/partner\//, { timeout: 30_000 })

    const otherPartnerId = '00000000-0000-0000-0000-000000000001'
    const block = await request.get(
      `${baseURL}/api/v2/partner/listings?partnerId=${encodeURIComponent(otherPartnerId)}`,
    )
    expect(block.status(), 'partner listings API: чужой partnerId → 403').toBe(403)

    await page.goto(`${baseURL}/admin/dashboard`, { waitUntil: 'domcontentloaded' })
    await expect(page).not.toHaveURL(/\/admin\//)
  })

  test('листинг байка: Забронировать и Написать; USD без ошибок DEFAULT_RATES', { tag: '@renter' }, async ({
    page,
    baseURL,
    request,
  }) => {
    test.skip(!baseURL, 'baseURL')
    await page.setViewportSize({ width: 1280, height: 900 })
    const lr = await request.get(
      `${baseURL}/api/v2/listings?category=${E2E_STRINGS.bikeCategory}&limit=30&status=ACTIVE`,
    )
    expect(lr.ok()).toBeTruthy()
    const lj = await lr.json()
    const data = (lj?.data || []) as Array<{ id: string; title?: string }>
    const bike = data.find((x) => E2E_STRINGS.bikeTitleRegex.test(String(x.title || ''))) || data[0]
    test.skip(!bike?.id, 'Нет активного vehicle в каталоге')

    const ratesRes = await request.get(`${baseURL}/api/v2/exchange-rates`)
    const ratesJson = await ratesRes.json()
    const usd = ratesJson?.rateMap?.USD
    test.skip(!usd || !Number.isFinite(Number(usd)), 'Нет USD в exchange_rates')

    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => consoleErrors.push(err.message))

    await page.goto(`${baseURL}/listings/${bike.id}`, { waitUntil: 'domcontentloaded' })
    await page.getByTestId(E2E_TEST_IDS.currencySelector).click()
    await page.getByTestId('currency-option-USD').click()
    await page.waitForTimeout(800)

    await expect(page.getByRole('button', { name: /Забронировать|Book now|จอง/i })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.locator(`[data-testid="${E2E_TEST_IDS.bookingContactHost}"]`)).toBeVisible()

    const priceText = await page.locator('main').getByText(/\$\d|USD/).first().textContent().catch(() => '')
    expect(String(priceText).length).toBeGreaterThan(0)

    const bad = consoleErrors.filter((t) => /DEFAULT_RATES|convertFromThb|convertToThb/i.test(t))
    expect(bad, `Unexpected FX legacy console errors: ${bad.join(' | ')}`).toEqual([])
  })
})

test.describe('Admin', () => {
  test('доступ к ключевым разделам админки', { tag: '@admin' }, async ({ page, baseURL, request }) => {
    test.skip(!baseURL, 'baseURL')
    const mj = await fetchAuthMeWithRetry(request, baseURL)
    const adminRole = String(mj?.user?.role || '')
    expect(
      ['ADMIN', 'MODERATOR'].includes(adminRole),
      `E2E_ADMIN_EMAIL: ожидалась роль ADMIN или MODERATOR, получено ${adminRole}`,
    ).toBeTruthy()

    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`${baseURL}/admin/dashboard`, { waitUntil: 'domcontentloaded' })
    const nav = page.locator('aside nav')
    await expect(nav.getByRole('link', { name: 'Dashboard' })).toBeVisible({ timeout: 60_000 })
    await expect(nav.getByRole('link', { name: 'Модерация' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Категории' })).toBeVisible()
    if (adminRole === 'ADMIN') {
      await expect(nav.getByRole('link', { name: 'Пользователи' })).toBeVisible()
    }
  })

  test('скриншот: панель управления (dashboard)', { tag: '@admin' }, async ({ page, baseURL }) => {
    test.skip(!baseURL, 'baseURL')
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`${baseURL}/admin/dashboard`)
    await page.waitForLoadState('networkidle').catch(() => {})
    const buf = await page.screenshot({ fullPage: true })
    await test.info().attach('admin-dashboard', { body: buf, contentType: 'image/png' })
    const outDir = path.join(process.cwd(), 'test-results', 'audit')
    fs.mkdirSync(outDir, { recursive: true })
    await page.screenshot({ path: path.join(outDir, 'admin-dashboard.png'), fullPage: true })
  })
})
