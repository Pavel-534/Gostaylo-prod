/**
 * Chat Control Bot (#27)
 * Проверяет typing, звук и политику suppress пуша для активного треда.
 */
import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { E2E_FIXTURE_SECRET, E2E_HEADERS, E2E_ROUTES, E2E_TEST_IDS } from '../constants'

test.describe.configure({ mode: 'serial' })

test.describe('@chat-control-bot', () => {
  let conversationId: string | null = null

  test.beforeAll(async ({ playwright, baseURL }) => {
    if (!baseURL || !E2E_FIXTURE_SECRET) return
    const api = await playwright.request.newContext({
      baseURL,
      storageState: 'playwright/.auth/partner.json',
    })
    try {
      const res = await api.post(E2E_ROUTES.pendingChatBookingFixture, {
        headers: { [E2E_HEADERS.fixtureSecretHeader]: E2E_FIXTURE_SECRET },
        data: {},
      })
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean
        data?: { conversationId?: string }
      }
      if (res.ok() && json?.success && json?.data?.conversationId) {
        conversationId = json.data.conversationId
      }
    } finally {
      await api.dispose()
    }
  })

  test('typing-событие доходит по Realtime Broadcast каналу', async ({ playwright, baseURL }) => {
    test.skip(!baseURL, 'baseURL')
    test.skip(!conversationId, 'conversation fixture required')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    test.skip(!supabaseUrl || !supabaseAnon, 'Supabase public env required')

    const partnerApi = await playwright.request.newContext({
      baseURL,
      storageState: 'playwright/.auth/partner.json',
    })
    const renterApi = await playwright.request.newContext({
      baseURL,
      storageState: 'playwright/.auth/user.json',
    })

    const partnerClient = createClient(supabaseUrl!, supabaseAnon!)
    const renterClient = createClient(supabaseUrl!, supabaseAnon!)
    const channelName = `typing:${conversationId}`

    try {
      const [partnerTokenRes, renterTokenRes] = await Promise.all([
        partnerApi.get('/api/v2/auth/realtime-token'),
        renterApi.get('/api/v2/auth/realtime-token'),
      ])
      expect(partnerTokenRes.ok()).toBeTruthy()
      expect(renterTokenRes.ok()).toBeTruthy()
      const partnerTokenJson = (await partnerTokenRes.json()) as { access_token?: string }
      const renterTokenJson = (await renterTokenRes.json()) as { access_token?: string }
      expect(partnerTokenJson.access_token).toBeTruthy()
      expect(renterTokenJson.access_token).toBeTruthy()

      partnerClient.realtime.setAuth(partnerTokenJson.access_token!)
      renterClient.realtime.setAuth(renterTokenJson.access_token!)

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('typing event timeout')), 20_000)
        let recvReady = false
        let sendReady = false
        let emitted = false
        const maybeEmit = (sendChannel) => {
          if (emitted || !recvReady || !sendReady) return
          emitted = true
          void sendChannel.send({
            type: 'broadcast',
            event: 'typing',
            payload: { userId: 'chat-control-bot', name: 'Chat Control Bot' },
          })
        }
        const recv = renterClient
          .channel(channelName, { config: { broadcast: { self: false } } })
          .on('broadcast', { event: 'typing' }, ({ payload }) => {
            if (payload?.name && payload?.userId) {
              clearTimeout(timeout)
              resolve()
            }
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              recvReady = true
            }
          })

        const send = partnerClient
          .channel(channelName, { config: { broadcast: { self: false } } })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              sendReady = true
              maybeEmit(send)
            }
          })

        const tick = setInterval(() => maybeEmit(send), 150)
        const clearAll = () => {
          clearInterval(tick)
          clearTimeout(timeout)
        }
        recv.on('broadcast', { event: 'typing' }, () => clearAll())
        void recv
      })
    } finally {
      await partnerApi.dispose()
      await renterApi.dispose()
      partnerClient.removeAllChannels()
      renterClient.removeAllChannels()
    }
  })

  test('звук срабатывает при событии нового сообщения вне текущего диалога', async ({ browser, baseURL }) => {
    test.skip(!baseURL, 'baseURL')
    test.skip(!conversationId, 'conversation fixture required')

    const partnerCtx = await browser.newContext({ storageState: 'playwright/.auth/partner.json' })

    await partnerCtx.addInitScript(() => {
      window.__chatControlPlayCount = 0
      if (!window.Audio || !window.Audio.prototype) return
      const proto = window.Audio.prototype
      if (window.__chatControlAudioPatched || typeof proto.play !== 'function') {
        return
      }
      const orig = proto.play
      proto.play = function (...args) {
        window.__chatControlPlayCount = (window.__chatControlPlayCount || 0) + 1
        try {
          return orig.apply(this, args)
        } catch {
          return Promise.resolve()
        }
      }
      window.__chatControlAudioPatched = true
    })

    const partner = await partnerCtx.newPage()
    try {
      await partner.goto(`${baseURL}/messages/`, { waitUntil: 'domcontentloaded' })
      await expect(partner.getByTestId(E2E_TEST_IDS.chatComposerTextarea)).toHaveCount(0, { timeout: 45_000 })

      await expect
        .poll(
          () =>
            partner.evaluate((cid) => {
              window.dispatchEvent(
                new CustomEvent('gostaylo:push-message', {
                  detail: { type: 'NEW_MESSAGE', conversationId: `${cid}-other` },
                }),
              )
              return Number(window.__chatControlPlayCount || 0)
            }, conversationId),
          { timeout: 20_000 },
        )
        .toBeGreaterThan(0)
    } finally {
      await partnerCtx.close()
    }
  })

  test('Premium Quiet SW: suppress NEW_MESSAGE при любой видимой вкладке того же origin', async ({
    browser,
    baseURL,
  }) => {
    test.skip(!baseURL, 'baseURL')
    test.skip(!conversationId, 'conversation fixture required')

    const origin = new URL(baseURL).origin
    const ctx = await browser.newContext({ storageState: 'playwright/.auth/partner.json' })
    const page = await ctx.newPage()
    try {
      await page.goto(`${baseURL}/messages/${conversationId}/`, { waitUntil: 'domcontentloaded' })
      await page.addScriptTag({ url: '/push-visibility-policy.js' })

      const visibleSuppressed = await page.evaluate(
        ({ pageOrigin }) => {
          const windows = [{ url: window.location.href, visibilityState: 'visible' }]
          return Boolean(
            window.GostayloPushPolicy?.shouldSuppressSystemNotificationForNewMessage?.(windows, pageOrigin),
          )
        },
        { pageOrigin: origin },
      )
      expect(visibleSuppressed).toBeTruthy()

      const hiddenNotSuppressed = await page.evaluate(
        ({ pageOrigin }) => {
          const windows = [{ url: window.location.href, visibilityState: 'hidden' }]
          return Boolean(
            window.GostayloPushPolicy?.shouldSuppressSystemNotificationForNewMessage?.(windows, pageOrigin),
          )
        },
        { pageOrigin: origin },
      )
      expect(hiddenNotSuppressed).toBeFalsy()
    } finally {
      await ctx.close()
    }
  })
})

