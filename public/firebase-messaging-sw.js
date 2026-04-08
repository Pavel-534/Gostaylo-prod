/* global self, clients, registration */

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
      let payload = {}
      try {
        payload = event.data ? event.data.json() : {}
      } catch {
        payload = {}
      }

      const data = payload?.data || {}
      const type = String(data.type || '').toUpperCase()
      const link = String(data.link || '/')
      const cid = parseConversationId(link, data)
      const windows = await postToClients(data)

      if (type === 'BADGE_UPDATE') return

      const hasVisibleSameChat = windows.some((w) => {
        try {
          const u = new URL(w.url)
          const m = u.pathname.match(/^\/messages\/([^/?#]+)/)
          const openCid = m?.[1] ? decodeURIComponent(m[1]) : null
          return w.visibilityState === 'visible' && cid && openCid === cid
        } catch {
          return false
        }
      })

      if (hasVisibleSameChat) return

      const title = data._title || payload?.notification?.title || 'Новое сообщение'
      const body = data._body || payload?.notification?.body || 'У вас новое сообщение'

      await registration.showNotification(title, {
        body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        tag: cid ? `message:${cid}` : 'message',
        renotify: false,
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
      const exact = windows.find((w) => w.url.includes(link))
      if (exact) {
        await exact.focus()
        return
      }
      const any = windows[0]
      if (any) {
        await any.focus()
        return
      }
      await clients.openWindow(link)
    })(),
  )
})
