/**
 * Stress: 20 сообщений подряд через API, проверка порядка в UI.
 * Только fixture-беседа (E2E_FIXTURE_SECRET), не первый чат из списка.
 * @tag @stress
 */
import { test, expect, type APIRequestContext } from '@playwright/test'
import { E2E_FIXTURE_SECRET, E2E_HEADERS, E2E_ROUTES, E2E_TEST_IDS } from './constants'
import { E2E_TEST_DATA_TAG } from '../../lib/e2e/test-data-tag.js'
import { E2E_CHAT_STRESS_TAG } from '../../lib/e2e/chat-stress-message-markers.js'

const N = 20
const STRESS_PREFIX = `${E2E_TEST_DATA_TAG} ${E2E_CHAT_STRESS_TAG}`

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
    console.warn('[chat-stress fixture]', res.status(), j?.error || j)
    return null
  }
  return j.data.conversationId
}

test.describe('Chat stress (partner)', () => {
  test('20 сообщений подряд: порядок в треде и время отрисовки @stress', async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000)
    test.skip(!baseURL, 'baseURL')
    test.skip(!E2E_FIXTURE_SECRET, 'E2E_FIXTURE_SECRET required — не писать в production-чаты')

    const convId = await createFixtureConversation(page.request)
    test.skip(!convId, 'Fixture conversation was not created')

    const runId = `st${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

    for (let i = 0; i < N; i++) {
      const pr = await page.request.post(`${baseURL}${E2E_ROUTES.chatMessages}`, {
        headers: { 'Content-Type': E2E_HEADERS.jsonContentType },
        data: {
          conversationId: convId,
          content: `${STRESS_PREFIX} ${runId}-seq-${i}`,
          type: 'text',
        },
      })
      expect(pr.ok(), `POST message ${i}`).toBeTruthy()
    }

    const t0 = Date.now()
    await page.goto(`${baseURL}/messages/${encodeURIComponent(convId)}`, {
      waitUntil: 'domcontentloaded',
    })

    const thread = page.getByTestId(E2E_TEST_IDS.chatThreadScroll)
    await expect(thread.getByText(`${runId}-seq-0`, { exact: true })).toBeVisible({ timeout: 60_000 })

    for (let i = 0; i < N; i++) {
      const label = `${runId}-seq-${i}`
      const loc = thread.getByText(label, { exact: true })
      await loc.scrollIntoViewIfNeeded()
      await expect(loc).toBeVisible({ timeout: 45_000 })
    }

    const order = await page.evaluate<number[], { rid: string; threadTestId: string }>(
      ({ rid, threadTestId }) => {
        const el = document.querySelector(`[data-testid="${threadTestId}"]`)
        if (!el) return []
        const htmlEl = el as HTMLElement
        const re = new RegExp(`${rid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-seq-(\\d+)`, 'g')
        const text = htmlEl.innerText
        const out: number[] = []
        let m: RegExpExecArray | null
        while ((m = re.exec(text)) !== null) {
          out.push(parseInt(m[1], 10))
        }
        return out
      },
      { rid: runId, threadTestId: E2E_TEST_IDS.chatThreadScroll },
    )

    const expected = Array.from({ length: N }, (_, i) => i)
    expect(order.length).toBeGreaterThanOrEqual(N)
    expect(order.slice(0, N)).toEqual(expected)

    const elapsed = Date.now() - t0
    expect(elapsed, 'страница + проверка 20 пузырей').toBeLessThan(115_000)
  })
})
