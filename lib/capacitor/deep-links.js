/**
 * Capacitor deep-link path allowlist (Stage 172.0).
 * Native shell must only open known product routes — never arbitrary URLs.
 */

const ALLOWED_PREFIXES = [
  '/checkout/',
  '/messages/',
  '/messages',
  '/listings/',
  '/my-bookings',
  '/renter/',
  '/partner/',
  '/profile',
  '/login',
]

/**
 * @param {string | null | undefined} rawUrl
 * @returns {string | null} path+search for in-app navigation, or null if reject
 */
export function resolveCapacitorDeepLinkPath(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null
  let pathname = ''
  let search = ''
  try {
    if (rawUrl.startsWith('/')) {
      const u = new URL(rawUrl, 'https://airento.local')
      pathname = u.pathname
      search = u.search
    } else {
      const u = new URL(rawUrl)
      pathname = u.pathname
      search = u.search
    }
  } catch {
    return null
  }

  const path = pathname.replace(/\/+$/, '') || '/'
  const ok = ALLOWED_PREFIXES.some((prefix) => {
    if (prefix === '/messages') return path === '/messages' || path.startsWith('/messages/')
    if (prefix.endsWith('/')) return path.startsWith(prefix.slice(0, -1)) || path.startsWith(prefix)
    return path === prefix || path.startsWith(`${prefix}/`)
  })
  if (!ok) return null
  return `${path}${search}`
}

/**
 * Map FCM / APNs data payload → in-app path.
 * @param {Record<string, unknown> | null | undefined} data
 */
export function deepLinkPathFromPushData(data) {
  if (!data || typeof data !== 'object') return null
  const link = String(data.link || data.url || data.path || '').trim()
  if (link) return resolveCapacitorDeepLinkPath(link)
  const conversationId = String(data.conversationId || data.conversation_id || '').trim()
  if (conversationId) return `/messages/${encodeURIComponent(conversationId)}`
  const bookingId = String(data.bookingId || data.booking_id || '').trim()
  if (bookingId && String(data.openCheckout || '') === '1') {
    return `/checkout/${encodeURIComponent(bookingId)}`
  }
  return null
}
