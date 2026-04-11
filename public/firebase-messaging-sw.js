/* global self, clients, registration */
importScripts('/push-visibility-policy.js')

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

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      // Remote debug: Chrome → remote device → inspect SW → Console.
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
      const link = String(data.link || '/')
      const cid = parseConversationId(link, data)
      const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true })

      if (type === 'BADGE_UPDATE') {
        await postToClients(data)
        return
      }

      const hasVisibleSameChat =
        !!self.GostayloPushPolicy &&
        typeof self.GostayloPushPolicy.shouldSuppressPushForConversation === 'function'
          ? self.GostayloPushPolicy.shouldSuppressPushForConversation(windows, cid)
          : false

      // Не дублируем postMessage на вкладку, где уже открыт этот чат — Realtime и так обновит UI.
      // Иначе каждый пуш даёт refresh() на главном потоке и при лавине сообщений вкладка зависает.
      if (!hasVisibleSameChat) {
        for (const c of windows) c.postMessage({ type: 'gostaylo_push', payload: data })
      }

      if (hasVisibleSameChat) return

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
  const link = event.notification?.data?.link || '/'
  event.waitUntil(
    (async () => {
      const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true })
      const normalize = (u) => {
        try {
          return new URL(u).pathname.replace(/\/+$/, '')
        } catch {
          return ''
        }
      }
      const targetPath = normalize(link)
      const exact = windows.find((w) => {
        if (!targetPath) return false
        return normalize(w.url) === targetPath || String(w.url || '').includes(targetPath)
      })
      if (exact) {
        await exact.focus()
        return
      }
      await clients.openWindow(link)
    })(),
  )
})
