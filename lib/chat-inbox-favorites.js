/**
 * Избранные диалоги инбокса (локально, localStorage).
 * Пока нет поля в API — UX-фильтр «Избранные» на клиенте.
 */
const STORAGE_KEY = 'gostaylo_inbox_favorite_conversations'

function readIds() {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const arr = JSON.parse(raw || '[]')
    return Array.isArray(arr) ? arr.map(String) : []
  } catch {
    return []
  }
}

export function getFavoriteConversationIdSet() {
  return new Set(readIds())
}

export function toggleFavoriteConversationId(conversationId) {
  if (typeof window === 'undefined' || !conversationId) return new Set()
  const id = String(conversationId)
  const prev = readIds()
  const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent('gostaylo-inbox-favorites-changed'))
  return new Set(next)
}

export function isFavoriteConversationId(conversationId, set) {
  return set?.has(String(conversationId))
}
