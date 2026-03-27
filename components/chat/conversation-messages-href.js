/**
 * Умная ссылка на тред сообщений: партнёрский кабинет для хозяина, рентерский — для гостя.
 * Не трогает lib/chat и хуки — только навигация UI.
 *
 * @param {string|null|undefined} userId
 * @param {{ id: string, partnerId?: string, partner_id?: string, renterId?: string, renter_id?: string }} conversation
 * @returns {string|null}
 */
export function conversationMessagesHref(userId, conversation) {
  if (!userId || !conversation?.id) return null
  const partnerId = conversation.partnerId ?? conversation.partner_id
  if (partnerId != null && String(partnerId) === String(userId)) {
    return `/partner/messages/${conversation.id}`
  }
  return `/renter/messages/${conversation.id}`
}
