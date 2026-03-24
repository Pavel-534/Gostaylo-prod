/**
 * Вкладки инбокса: Hosting (я partner_id) vs Traveling (я renter_id).
 * Ключ для рентерского кабинета отдельный, чтобы «Задать вопрос» не ломал партнёрский список.
 */

export const INBOX_TAB_HOSTING = 'hosting'
export const INBOX_TAB_TRAVELING = 'traveling'

const RENTER_TAB_KEY = 'gostaylo_inbox_tab_renter'

export function setRenterInboxTabPreference(tab) {
  if (tab !== INBOX_TAB_HOSTING && tab !== INBOX_TAB_TRAVELING) return
  try {
    sessionStorage.setItem(RENTER_TAB_KEY, tab)
  } catch {
    /* ignore */
  }
}

/** Прочитать и сбросить предпочтение вкладки для /renter/messages */
export function consumeRenterInboxTabPreference() {
  if (typeof window === 'undefined') return null
  try {
    const v = sessionStorage.getItem(RENTER_TAB_KEY)
    if (v === INBOX_TAB_HOSTING || v === INBOX_TAB_TRAVELING) {
      sessionStorage.removeItem(RENTER_TAB_KEY)
      return v
    }
  } catch {
    /* ignore */
  }
  return null
}

export function filterConversationsByInboxTab(conversations, userId, tab) {
  if (!userId || !Array.isArray(conversations)) return []
  if (tab === INBOX_TAB_HOSTING) {
    return conversations.filter((c) => String(c.partnerId) === String(userId))
  }
  return conversations.filter((c) => String(c.renterId) === String(userId))
}

export function sumUnreadInConversations(list) {
  return list.reduce((s, c) => s + (Number(c.unreadCount) || 0), 0)
}
