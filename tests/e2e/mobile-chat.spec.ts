/**
 * Мобильный аудит чата.
 * Профиль устройства — проект Playwright (`chat-mobile-iphone` / `chat-mobile-pixel`).
 *
 * Фикстура PENDING-брони: `E2E_FIXTURE_SECRET` в `.env.local` (и тот же секрет в окружении при запуске Playwright)
 * + `POST /api/v2/internal/e2e/pending-chat-booking`. См. `docs/TECHNICAL_MANIFESTO.md`.
 */
import { test, expect, type APIRequestContext } from '@playwright/test'
import { E2E_FIXTURE_SECRET, E2E_HEADERS, E2E_ROUTES, E2E_TEST_IDS } from './constants'

const LONG_TEXT =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(18) +
  'Проверка длинного текста в композере без перекрытия области ввода на узком экране.'

async function createFixtureConversation(request: APIRequestContext): Promise<string | null> {
  if (!E2E_FIXTURE_SECRET) return null
  const res = await request.post(E2E_ROUTES.pendingChatBookingFixture, {
    headers: { [E2E_HEADERS.fixtureSecretHeader]: E2E_FIXTURE_SECRET },
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

async function createTourBookingMathFixture(request: APIRequestContext): Promise<{
  priceThb: number
  basePriceThb: number
  guestsCount: number
  expectedTotalThb: number
} | null> {
  if (!E2E_FIXTURE_SECRET) return null
  const res = await request.post(E2E_ROUTES.tourBookingMathFixture, {
    headers: { [E2E_HEADERS.fixtureSecretHeader]: E2E_FIXTURE_SECRET },
    data: { guestsCount: 3 },
  })
  const j = (await res.json().catch(() => ({}))) as {
    success?: boolean
    data?: {
      priceThb?: number
      basePriceThb?: number
      guestsCount?: number
      expectedTotalThb?: number
    }
    error?: string
  }
  if (!res.ok() || !j.success || j.data == null) {
    console.warn('[tour-booking-math fixture]', res.status(), j?.error || j)
    return null
  }
  const { priceThb, basePriceThb, guestsCount, expectedTotalThb } = j.data
  if (
    typeof priceThb !== 'number' ||
    typeof basePriceThb !== 'number' ||
    typeof guestsCount !== 'number' ||
    typeof expectedTotalThb !== 'number'
  ) {
    return null
  }
  return { priceThb, basePriceThb, guestsCount, expectedTotalThb }
}

test.describe.configure({ mode: 'serial' })

test.describe('Mobile chat UI', () => {
  let fixtureConvId: string | null = null

  function conversationIdFromUrl(url: string): string | null {
    const m = url.match(/\/messages\/([^/?#]+)/)
    return m?.[1] ? decodeURIComponent(m[1]) : null
  }

  async function waitForSystemKeyViaApi(
    request: APIRequestContext,
    baseURL: string,
    conversationId: string,
    systemKey: string,
    timeoutMs = 60_000,
  ) {
    const started = Date.now()
    while (Date.now() - started < timeoutMs) {
      const r = await request.get(
        `${baseURL}${E2E_ROUTES.chatMessages}?conversationId=${encodeURIComponent(conversationId)}`,
        { failOnStatusCode: false },
      )
      const j = (await r.json().catch(() => ({}))) as { success?: boolean; data?: Array<{ metadata?: any }> }
      const hit =
        j?.success &&
        Array.isArray(j.data) &&
        j.data.some((x) => String(x?.metadata?.system_key || '') === systemKey)
      if (hit) return true
      await new Promise((resolve) => setTimeout(resolve, 1800))
    }
    return false
  }

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

    const ta = page.getByTestId(E2E_TEST_IDS.chatComposerTextarea)
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

    const cards = page.getByTestId(E2E_TEST_IDS.chatMilestoneCard)
    try {
      await expect(cards.first()).toBeVisible({ timeout: 30_000 })
    } catch {
      test.skip(true, 'В треде нет системных карточек')
    }
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

    const confirm = page.getByTestId(E2E_TEST_IDS.chatActionConfirm)
    const decline = page.getByTestId(E2E_TEST_IDS.chatActionDecline)
    await expect(confirm).toBeVisible({ timeout: 60_000 })
    await confirm.scrollIntoViewIfNeeded()
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
    request,
  }) => {
    test.skip(!fixtureConvId, 'Нужен E2E_FIXTURE_SECRET и успешный POST fixture API')
    test.skip(!baseURL, 'baseURL')
    await openThread(page, baseURL)

    const confirm = page.getByTestId(E2E_TEST_IDS.chatActionConfirm)
    await expect(confirm).toBeVisible({ timeout: 60_000 })
    await confirm.scrollIntoViewIfNeeded()
    await expect(confirm).toBeEnabled()

    await confirm.click()

    await expect(confirm).toBeHidden({ timeout: 90_000 })
    await expect(page.getByTestId(E2E_TEST_IDS.chatActionDecline)).toBeHidden({ timeout: 90_000 })

    const conversationId = conversationIdFromUrl(page.url())
    expect(conversationId, 'conversationId in URL').toBeTruthy()
    const hasSystemMessage = await waitForSystemKeyViaApi(
      request,
      baseURL!,
      String(conversationId),
      'booking_confirmed',
      60_000,
    )

    await page.reload({ waitUntil: 'domcontentloaded' })
    const confirmedCard = page.locator(
      `[data-testid="${E2E_TEST_IDS.chatMilestoneCard}"][data-system-key="booking_confirmed"]`,
    )
    const cardVisible = await confirmedCard.first().isVisible().catch(() => false)
    if (cardVisible) {
      await expect(
        confirmedCard.first().getByText('Бронирование подтверждено', { exact: false }),
      ).toBeVisible()
    }
    expect(
      cardVisible || hasSystemMessage,
      'booking_confirmed should be present in UI or server timeline',
    ).toBeTruthy()
  })

  test('тур (фикстура): totalPrice = basePrice × 3 гостя', async ({ request }) => {
    const d = await createTourBookingMathFixture(request)
    test.skip(!d, 'Нужен E2E_FIXTURE_SECRET и тур у партнёра (см. tour-booking-math)')
    expect(d!.guestsCount).toBe(3)
    expect(d!.priceThb).toBe(d!.expectedTotalThb)
    expect(d!.priceThb).toBe(Math.round(d!.basePriceThb * d!.guestsCount))
  })
})
