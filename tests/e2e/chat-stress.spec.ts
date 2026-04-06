/**
 * Stress: 20 сообщений подряд через API, проверка порядка в UI.
 * @tag @stress
 */
import { test, expect } from '@playwright/test'

const N = 20

test.describe('Chat stress (partner)', () => {
  test('20 сообщений подряд: порядок в треде и время отрисовки', { tag: '@stress', timeout: 120_000 }, async ({
    page,
    baseURL,
  }) => {
    test.skip(!baseURL, 'baseURL')

    await page.goto(`${baseURL}/partner`, { waitUntil: 'domcontentloaded' })
    const listRes = await page.request.get(`${baseURL}/api/v2/chat/conversations?archived=all&limit=10`)
    expect(listRes.ok()).toBeTruthy()
    const listJson = await listRes.json()
    const convId = listJson?.data?.[0]?.id as string | undefined
    test.skip(!convId, 'Нет бесед для stress-теста')

    const runId = `st${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

    for (let i = 0; i < N; i++) {
      const pr = await page.request.post(`${baseURL}/api/v2/chat/messages`, {
        data: {
          conversationId: convId,
          content: `${runId}-seq-${i}`,
          type: 'text',
        },
      })
      expect(pr.ok(), `POST message ${i}`).toBeTruthy()
    }

    const t0 = Date.now()
    await page.goto(`${baseURL}/messages/${encodeURIComponent(convId)}`, {
      waitUntil: 'domcontentloaded',
    })

    const thread = page.getByTestId('chat-thread-scroll')
    await expect(thread.getByText(`${runId}-seq-0`, { exact: true })).toBeVisible({ timeout: 60_000 })

    for (let i = 0; i < N; i++) {
      const label = `${runId}-seq-${i}`
      const loc = thread.getByText(label, { exact: true })
      await loc.scrollIntoViewIfNeeded()
      await expect(loc).toBeVisible({ timeout: 45_000 })
    }

    const order = await page.evaluate((rid) => {
      const el = document.querySelector('[data-testid="chat-thread-scroll"]')
      if (!el) return []
      const re = new RegExp(`${rid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-seq-(\\d+)`, 'g')
      const text = el.innerText
      const out: number[] = []
      let m: RegExpExecArray | null
      while ((m = re.exec(text)) !== null) {
        out.push(parseInt(m[1], 10))
      }
      return out
    }, runId)

    const expected = Array.from({ length: N }, (_, i) => i)
    expect(order.length).toBeGreaterThanOrEqual(N)
    expect(order.slice(0, N)).toEqual(expected)

    const elapsed = Date.now() - t0
    expect(elapsed, 'страница + проверка 20 пузырей').toBeLessThan(115_000)
  })
})
