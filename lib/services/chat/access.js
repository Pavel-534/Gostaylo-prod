/**
 * Проверка доступа к беседе по участникам (owner / partner / renter / admin).
 * ADMIN и MODERATOR: полный READ (и запись от имени поддержки) ко всем диалогам.
 */

export const STAFF_ROLES = ['ADMIN', 'MODERATOR']

export function isStaffRole(role) {
  if (!role) return false
  return STAFF_ROLES.includes(String(role).toUpperCase())
}

export function userParticipatesInConversation(userId, conversation) {
  if (!userId || !conversation) return false
  const uid = String(userId)
  return (
    String(conversation.owner_id) === uid ||
    String(conversation.partner_id) === uid ||
    String(conversation.renter_id) === uid ||
    String(conversation.admin_id) === uid
  )
}

/**
 * Чтение истории и метаданных беседы (GET messages, read receipts, списки для саппорта).
 */
export function canReadConversation(userId, userRole, conversation) {
  if (!userId || !conversation) return false
  if (isStaffRole(userRole)) return true
  return userParticipatesInConversation(userId, conversation)
}

/**
 * Отправка сообщений: участник беседы или сотрудник поддержки.
 */
export function canWriteConversation(userId, userRole, conversation) {
  return canReadConversation(userId, userRole, conversation)
}

/** Роль из profiles.role (единственный источник истины). */
export function effectiveRoleFromProfile(profile) {
  if (!profile) return 'USER'
  return String(profile.role || 'USER').toUpperCase()
}
