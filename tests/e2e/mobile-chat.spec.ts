/**
 * Мобильный аудит чата.
 * Профиль устройства — проект Playwright (`chat-mobile-iphone` / `chat-mobile-pixel`).
 *
 * Фикстура PENDING-брони: `E2E_FIXTURE_SECRET` в `.env.local` (и тот же секрет в окружении при запуске Playwright)
 * + `POST /api/v2/internal/e2e/pending-chat-booking`. См. `docs/TECHNICAL_MANIFESTO.md`.
 */
import { test, expect } from '@playwright/test'

const LONG_TEXT =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(18) +
  'Проверка длинного текста в композере без перекрытия области ввода на узком экране.'

async function createFixtureConversation(request: APIRequestContext): Promise<string | null> {
  const secret = (process.env.E2E_FIXTURE_SECRET || '').trim()
  if (!secret) return null
  const res = await request.post('/api/v2/internal/e2e/pending-chat-booking', {
    headers: { 'x-e2e-fixture-secret': secret },
    data: {},
  })
  const j = (await res.json().catch(() => ({}))) as {
    success?: boolean
    data?: { conversationId?: string }
    error?: string
  }
  if (!res.ok() || !j.success || !j.data?.conversationId) {
    console.warn('[mobile-chat fixture]', res.status(), j?.error || j)
    return null
  }
  return j.data.conversationId
}

test.describe.configure({ mode: 'serial' })

test.describe('Mobile chat UI', () => {
  let fixtureConvId: string | null = null

  test.beforeAll(async ({ request }) => {
    fixtureConvId = await createFixtureConversation(request)
  })

  /** Открыть тред: приоритет фикстура, иначе первая беседа в списке. */
  async function openThread(page: import('@playwright/test').Page, baseURL: string | undefined) {
    test.skip(!baseURL, 'baseURL')
    if (fixtureConvId) {
      await page.goto(`${baseURL}/messages/${fixtureConvId}/`, { waitUntil: 'domcontentloaded' })
      await page.waitForURL(/\/messages\/[^/]+/, { timeout: 30_000 })
      return
    }
    await page.goto(`${baseURL}/messages/`, { waitUntil: 'domcontentloaded' })
    const row = page.locator('a[href^="/messages/"]').first()
    test.skip((await row.count()) === 0, 'Нет бесед — задайте E2E_FIXTURE_SECRET и листинг у партнёра')
    await row.click()
    await page.waitForURL(/\/messages\/[^/]+/, { timeout: 30_000 })
  }

  test('композер: длинный текст остаётся в видимой области после scrollIntoView', async ({
    page,
    baseURL,
  }) => {
    await openThread(page, baseURL)

    const ta = page.getByTestId('chat-composer-textarea')
    await expect(ta).toBeVisible({ timeout: 30_000 })
    await ta.fill(LONG_TEXT)
    await ta.scrollIntoViewIfNeeded()

    const box = await ta.boundingBox()
    const vh = page.viewportSize()?.height ?? 800
    expect(box, 'bounding box композера').toBeTruthy()
    expect(box!.y + box!.height).toBeLessThanOrEqual(vh + 120)
  })

  test('системная карточка на ширине 375px (узкий вьюпорт)', async ({ page, baseURL }) => {
    test.skip(!baseURL, 'baseURL')
    await page.setViewportSize({ width: 375, height: 812 })
    await openThread(page, baseURL)

    const cards = page.getByTestId('chat-milestone-card')
    test.skip((await cards.count()) === 0, 'В треде нет системных карточек')
    const milestone = cards.first()
    await milestone.scrollIntoViewIfNeeded()
    const w = (await milestone.boundingBox())?.width ?? 0
    expect(w).toBeGreaterThan(200)
    expect(w).toBeLessThanOrEqual(375)
  })

  test('фикстура: подтвердить/отклонить видны; тактильный отклик по pointerdown', async ({
    page,
    baseURL,
  }) => {
    test.skip(!fixtureConvId, 'Нужен E2E_FIXTURE_SECRET и успешный POST fixture API')
    test.skip(!baseURL, 'baseURL')
    await openThread(page, baseURL)

    const confirm = page.getByTestId('chat-action-confirm')
    const decline = page.getByTestId('chat-action-decline')
    await confirm.scrollIntoViewIfNeeded()
    await expect(confirm).toBeVisible({ timeout: 30_000 })
    await expect(confirm).toBeEnabled()
    await expect(decline).toBeVisible()
    await expect(decline).toBeEnabled()

    await confirm.dispatchEvent('pointerdown')
    await expect(confirm).toHaveAttribute('data-pressing', 'true')
    await expect(confirm).toHaveCSS('opacity', /0\.7/)
    await confirm.dispatchEvent('pointerup')
    await expect(confirm).toHaveAttribute('data-pressing', 'false')
  })

  test('после «Подтвердить»: action bar скрывается, карточка booking_confirmed в ленте', async ({
    page,
    baseURL,
  }) => {
    test.skip(!fixtureConvId, 'Нужен E2E_FIXTURE_SECRET и успешный POST fixture API')
    test.skip(!baseURL, 'baseURL')
    await openThread(page, baseURL)

    const confirm = page.getByTestId('chat-action-confirm')
    await confirm.scrollIntoViewIfNeeded()
    await expect(confirm).toBeVisible({ timeout: 30_000 })
    await expect(confirm).toBeEnabled()

    await confirm.click()

    await expect(confirm).toBeHidden({ timeout: 45_000 })
    await expect(page.getByTestId('chat-action-decline')).toBeHidden()

    const confirmedCard = page.locator('[data-testid="chat-milestone-card"][data-system-key="booking_confirmed"]')
    await expect(confirmedCard.first()).toBeVisible({ timeout: 45_000 })
    await expect(confirmedCard.getByText('Бронирование подтверждено', { exact: false })).toBeVisible()
  })
})
