/**
 * Stress: 20 сообщений подряд через API, проверка порядка в UI.
 * @tag @stress
 */
import { test, expect } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'
import { E2E_HEADERS, E2E_ROUTES, E2E_TEST_IDS } from './constants'

const N = 20

type PostOptions = NonNullable<Parameters<APIRequestContext['post']>[1]>

test.describe('Chat stress (partner)', () => {
  test('20 сообщений подряд: порядок в треде и время отрисовки @stress', async ({
    page,
    baseURL,
  }) => {
      test.setTimeout(120_000)
      test.skip(!baseURL, 'baseURL')

      await page.goto(`${baseURL}/partner`, { waitUntil: 'domcontentloaded' })
      const listRes = await page.request.get(`${baseURL}${E2E_ROUTES.chatConversations}?archived=all&limit=10`)
      expect(listRes.ok()).toBeTruthy()
      const listJson = await listRes.json()
      const convId = listJson?.data?.[0]?.id as string | undefined
      test.skip(!convId, 'Нет бесед для stress-теста')

      const runId = `st${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

      for (let i = 0; i < N; i++) {
        const opts: PostOptions = {
          headers: { 'Content-Type': E2E_HEADERS.jsonContentType },
          data: JSON.stringify({
            conversationId: convId,
            content: `${runId}-seq-${i}`,
            type: 'text',
          }),
        }
        const pr = await page.request.post(`${baseURL}${E2E_ROUTES.chatMessages}`, opts)
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

      const order = await page.evaluate<number[], { rid: string; threadTestId: string }>(({ rid, threadTestId }) => {
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
      }, { rid: runId, threadTestId: E2E_TEST_IDS.chatThreadScroll })

      const expected = Array.from({ length: N }, (_, i) => i)
      expect(order.length).toBeGreaterThanOrEqual(N)
      expect(order.slice(0, N)).toEqual(expected)

      const elapsed = Date.now() - t0
      expect(elapsed, 'страница + проверка 20 пузырей').toBeLessThan(115_000)
  })
})
