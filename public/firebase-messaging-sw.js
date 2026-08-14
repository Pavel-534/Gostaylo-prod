/* global self, clients, registration */
/**
 * FCM push handlers — imported by `/sw.js` (unified dispatcher).
 * Do not register install/activate/fetch here (owned by sw.js).
 *
 * Legacy direct registration: importScripts push policy only (handlers below).
 */
if (typeof self.GostayloPushPolicy === 'undefined') {
  try {
    importScripts('/push-visibility-policy.js')
  } catch {
    /* sw.js loads policy first */
  }
}

function parseConversationId(link, data) {
  if (data && data.conversationId) return String(data.conversationId)
  try {
    const u = new URL(link, self.location.origin)
    const m = u.pathname.match(/^\/messages\/([^/?#]+)/)
    return m?.[1] ? decodeURIComponent(m[1]) : null
  } catch {
    return null
  }
}

async function postToClients(payload) {
  const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const c of windows) c.postMessage({ type: 'gostaylo_push', payload })
  return windows
}

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      try {
        console.log('[SW Debug] push event (raw)', {
          hasData: !!event.data,
          t: new Date().toISOString(),
        })
      } catch (_) {}

      let payload = {}
      try {
        payload = event.data ? event.data.json() : {}
      } catch {
        payload = {}
      }

      try {
        console.log('[SW Debug] Message received in background!', JSON.stringify(payload).slice(0, 4000))
      } catch (_) {}

      try {
        const d = payload?.data || {}
        console.log('[Gostaylo SW] push type', String(d.type || '').toUpperCase() || '(none)')
      } catch (_) {}

      const data = payload?.data || {}
      const type = String(data.type || '').toUpperCase()
      const link = String(data.link || data.url || data.deepLink || '/')
      const cid = parseConversationId(link, data)
      const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true })

      async function ackSilentPush() {
        const ack = self.GostayloPushPolicy && self.GostayloPushPolicy.acknowledgePushWithoutUserBanner
        if (typeof ack === 'function') await ack(registration)
      }

      if (type === 'BADGE_UPDATE') {
        await postToClients(data)
        await ackSilentPush()
        return
      }

      const isNewMessage = type === 'NEW_MESSAGE'
      const suppressPremiumQuiet =
        isNewMessage &&
        !!self.GostayloPushPolicy &&
        typeof self.GostayloPushPolicy.shouldSuppressSystemNotificationForNewMessage === 'function' &&
        self.GostayloPushPolicy.shouldSuppressSystemNotificationForNewMessage(windows, self.location.origin)

      if (suppressPremiumQuiet) {
        await ackSilentPush()
        return
      }

      for (const c of windows) c.postMessage({ type: 'gostaylo_push', payload: data })

      const title = data._title || payload?.notification?.title || 'Новое сообщение'
      const body = data._body || payload?.notification?.body || 'У вас новое сообщение'
      const silent =
        String(data.silent || '') === '1' ||
        String(data.silentDelivery || '').toLowerCase() === 'true'

      await registration.showNotification(title, {
        body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        tag: cid ? `message:${cid}` : 'message',
        renotify: false,
        silent: !!silent,
        data: { link, conversationId: cid || null, ...data },
      })
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const raw =
    event.notification?.data?.link ||
    event.notification?.data?.url ||
    event.notification?.data?.deepLink ||
    '/'
  event.waitUntil(
    (async () => {
      let targetUrl = String(raw)
      try {
        targetUrl = new URL(targetUrl, self.location.origin).href
      } catch {
        targetUrl = self.location.origin + (targetUrl.startsWith('/') ? targetUrl : `/${targetUrl}`)
      }

      const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true })
      const normalizePath = (u) => {
        try {
          return new URL(u).pathname.replace(/\/+$/, '') || '/'
        } catch {
          return ''
        }
      }
      const targetPath = normalizePath(targetUrl)

      const samePath = windows.find((w) => {
        if (!targetPath) return false
        return normalizePath(w.url) === targetPath
      })
      const sameOrigin = windows.find((w) => {
        try {
          return new URL(w.url).origin === self.location.origin
        } catch {
          return false
        }
      })

      const focusClient = samePath || sameOrigin
      if (focusClient) {
        await focusClient.focus()
        try {
          if (typeof focusClient.navigate === 'function') {
            await focusClient.navigate(targetUrl)
            return
          }
        } catch {
          /* fall through to openWindow */
        }
        try {
          focusClient.postMessage({ type: 'gostaylo_push_navigate', url: targetUrl })
        } catch {
          /* ignore */
        }
        return
      }
      await clients.openWindow(targetUrl)
    })(),
  )
})
