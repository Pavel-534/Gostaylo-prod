/**
 * Stage 110.8 — единая политика звука входящего сообщения (ChatContext + push).
 */

/**
 * @param {string | null | undefined} pathname
 * @param {string | null | undefined} conversationId
 */
export function shouldPlayIncomingSoundForPath(pathname, conversationId) {
  if (typeof document === 'undefined' || document.visibilityState !== 'visible') return false
  const normalized = (pathname || '').replace(/\/+$/, '') || '/'
  const m = normalized.match(/^\/messages\/([^/?#]+)/)
  if (!m) return true
  const openConversationId = m[1] ? decodeURIComponent(m[1]) : null
  if (!openConversationId) return true
  return String(openConversationId) !== String(conversationId || '')
}
