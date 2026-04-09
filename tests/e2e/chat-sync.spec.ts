import path from 'path'
import { test, expect, type APIRequestContext } from '@playwright/test'
import { E2E_FIXTURE_SECRET, E2E_HEADERS, E2E_ROUTES, E2E_TEST_IDS } from './constants'

const AUTH_PARTNER = path.resolve(process.cwd(), 'playwright/.auth/partner.json')
const AUTH_RENTER = path.resolve(process.cwd(), 'playwright/.auth/user.json')

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
    console.warn('[chat-sync fixture]', res.status(), j?.error || j)
    return null
  }
  return j.data.conversationId
}

test.describe('Chat multi-session sync', () => {
  test('message delivery, unread badge and read ticks across sessions', async ({ browser, request, baseURL }) => {
    test.skip(!baseURL, 'baseURL required')
    test.skip(!E2E_FIXTURE_SECRET, 'E2E_FIXTURE_SECRET required for fixture conversation')

    const conversationId = await createFixtureConversation(request)
    test.skip(!conversationId, 'Fixture conversation was not created')
    const threadPath = `/messages/${encodeURIComponent(conversationId)}/`
    const marker = `E2E chat sync ${Date.now()}`

    const partnerContext = await browser.newContext({
      storageState: AUTH_PARTNER,
    })
    const renterContext = await browser.newContext({
      storageState: AUTH_RENTER,
      viewport: { width: 390, height: 844 },
    })
    const partnerPage = await partnerContext.newPage()
    const renterPage = await renterContext.newPage()

    try {
      await partnerPage.goto(`${baseURL}${threadPath}`, { waitUntil: 'domcontentloaded' })
      await expect(partnerPage.getByTestId(E2E_TEST_IDS.chatComposerTextarea)).toBeVisible({ timeout: 30_000 })

      await renterPage.goto(`${baseURL}/messages/`, { waitUntil: 'domcontentloaded' })
      await expect(renterPage.getByRole('heading', { name: /Сообщения|Messages/i })).toBeVisible({
        timeout: 30_000,
      })

      await partnerPage.getByTestId(E2E_TEST_IDS.chatComposerTextarea).fill(marker)
      await partnerPage.locator('form button[type="submit"]').last().click()
      await expect(partnerPage.getByText(marker)).toBeVisible({ timeout: 20_000 })

      await expect.poll(async () => {
        return await renterPage.evaluate(async (cid) => {
          const res = await fetch('/api/v2/chat/conversations?archived=all&enrich=1&limit=100', {
            credentials: 'include',
          })
          const j = await res.json().catch(() => ({}))
          const row = Array.isArray(j?.data) ? j.data.find((x: any) => String(x?.id) === String(cid)) : null
          return Number(row?.unreadCount || 0)
        }, conversationId)
      }, { timeout: 25_000 }).toBeGreaterThan(0)

      await renterPage.goto(`${baseURL}${threadPath}`, { waitUntil: 'domcontentloaded' })
      await expect.poll(async () => {
        return await renterPage.evaluate(async ({ cid, text }) => {
          const res = await fetch(`/api/v2/chat/messages?conversationId=${encodeURIComponent(String(cid))}`, {
            credentials: 'include',
          })
          const j = await res.json().catch(() => ({}))
          return Array.isArray(j?.data)
            ? j.data.some((m: any) => String(m?.content || m?.message || '').includes(String(text)))
            : false
        }, { cid: conversationId, text: marker })
      }, { timeout: 25_000 }).toBeTruthy()

      await expect.poll(async () => {
        return await partnerPage.evaluate(async ({ cid, text }) => {
          const res = await fetch(`/api/v2/chat/messages?conversationId=${encodeURIComponent(String(cid))}`, {
            credentials: 'include',
          })
          const j = await res.json().catch(() => ({}))
          if (!Array.isArray(j?.data)) return false
          const row = j.data.find((m: any) => String(m?.content || m?.message || '').includes(String(text)))
          return Boolean(row?.isRead)
        }, { cid: conversationId, text: marker })
      }, { timeout: 30_000 }).toBeTruthy()
    } finally {
      await partnerContext.close()
      await renterContext.close()
    }
  })
})
