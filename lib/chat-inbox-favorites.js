/**
 * Избранные диалоги: источник истины — API; localStorage только для одноразовой миграции и флага.
 * Событие gostaylo-inbox-favorites-changed — синхронизация компонентов в одном окне.
 */

export const LEGACY_STORAGE_KEY = 'gostaylo_inbox_favorite_conversations'
export const MIGRATED_FLAG_KEY = 'gostaylo_inbox_favorites_migrated_v1'

export const INBOX_FAVORITES_CHANGED_EVENT = 'gostaylo-inbox-favorites-changed'

export function dispatchInboxFavoritesChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(INBOX_FAVORITES_CHANGED_EVENT))
}

export function readLegacyFavoriteIds() {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY)
    const arr = JSON.parse(raw || '[]')
    return Array.isArray(arr) ? arr.map(String).filter(Boolean) : []
  } catch {
    return []
  }
}

export function isFavoritesMigrated() {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(MIGRATED_FLAG_KEY) === 'true'
}

export function setFavoritesMigrated() {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(MIGRATED_FLAG_KEY, 'true')
}

/** Для отображения: Set или массив id с сервера */
export function isFavoriteConversationId(conversationId, setOrList) {
  if (conversationId == null || !setOrList) return false
  const id = String(conversationId)
  if (setOrList instanceof Set) return setOrList.has(id)
  if (Array.isArray(setOrList)) return setOrList.includes(id)
  return false
}
