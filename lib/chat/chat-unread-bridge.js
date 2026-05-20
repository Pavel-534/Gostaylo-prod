/**
 * Stage 108.5 (D-05) — синхронизация totalUnread между useConversationInbox и ChatContext.
 * На /messages* Realtime списка ведёт только inbox-хук; глобальный бейдж читает сумму отсюда.
 */

/** @type {number | null} */
let inboxUnreadTotal = null
/** @type {Set<(n: number) => void>} */
const listeners = new Set()

/**
 * @param {number} total
 */
export function publishChatInboxUnreadTotal(total) {
  const n = Math.max(0, Number(total) || 0)
  inboxUnreadTotal = n
  for (const fn of listeners) {
    try {
      fn(n)
    } catch {
      /* ignore */
    }
  }
}

export function clearChatInboxUnreadBridge() {
  inboxUnreadTotal = null
}

/**
 * @param {(total: number) => void} listener
 * @returns {() => void}
 */
export function subscribeChatInboxUnreadTotal(listener) {
  listeners.add(listener)
  if (inboxUnreadTotal != null) {
    listener(inboxUnreadTotal)
  }
  return () => {
    listeners.delete(listener)
  }
}

export function getChatInboxUnreadTotal() {
  return inboxUnreadTotal
}

/** @param {string | null | undefined} pathname */
export function isMessagesInboxRoute(pathname) {
  const p = String(pathname || '').replace(/\/+$/, '') || '/'
  return p === '/messages' || p.startsWith('/messages/')
}
