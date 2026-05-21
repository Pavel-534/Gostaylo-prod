/**
 * Stage 110.5 — мост inbox Realtime → активный тред (без второй подписки на messages).
 * @see hooks/use-conversation-inbox.js, hooks/use-chat-thread-messages.js
 */

/**
 * @param {string | null | undefined} activeConversationId
 * @param {string | null | undefined} messageConversationId
 */
export function isActiveThreadMessage(activeConversationId, messageConversationId) {
  if (!activeConversationId || !messageConversationId) return false
  return String(activeConversationId) === String(messageConversationId)
}

/**
 * Проброс INSERT/UPDATE messages в обработчики треда, если открыт этот диалог.
 * @param {object} msg — payload.new из Realtime
 * @param {string | null | undefined} activeConversationId
 * @param {{ onInsert?: (raw: object) => void, onUpdate?: (raw: object) => void }} handlers
 * @param {'INSERT' | 'UPDATE'} eventType
 */
export function routeInboxMessageToActiveThread(msg, activeConversationId, handlers, eventType) {
  const convId = msg?.conversation_id
  if (!isActiveThreadMessage(activeConversationId, convId)) return
  if (eventType === 'INSERT' && typeof handlers.onInsert === 'function') {
    handlers.onInsert(msg)
  }
  if (eventType === 'UPDATE' && typeof handlers.onUpdate === 'function') {
    handlers.onUpdate(msg)
  }
}

/** @param {object} msg — payload.new */
export function handleInboxMessageUpdate(msg, activeConversationId, onActiveMessageUpdate) {
  if (!msg?.conversation_id) return
  routeInboxMessageToActiveThread(msg, activeConversationId, {
    onUpdate: onActiveMessageUpdate ?? undefined,
  }, 'UPDATE')
}
