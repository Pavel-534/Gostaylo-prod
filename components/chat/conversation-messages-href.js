/**
 * Ссылка на тред в едином холле сообщений (Этап 2).
 * userId оставлен для обратной совместимости вызовов; логика кабинета больше не нужна.
 *
 * @param {string|null|undefined} userId
 * @param {{ id: string }} conversation
 * @returns {string|null}
 */
export function conversationMessagesHref(userId, conversation) {
  if (!userId || !conversation?.id) return null
  return `/messages/${encodeURIComponent(conversation.id)}`
}
