/**
 * Сообщения с metadata.hidden_from_recipient не показываются получателю (авто-shadowban по страйкам).
 */

import { isStaffRole } from '@/lib/services/chat/access'

/**
 * @param {object} rawMsg — сырая строка messages (REST или Realtime)
 * @param {string} viewerUserId
 * @param {string|null|undefined} viewerRole — роль текущего пользователя
 * @returns {boolean} true если сообщение нужно скрыть от зрителя
 */
export function isMessageHiddenFromViewer(rawMsg, viewerUserId, viewerRole) {
  if (!rawMsg || isStaffRole(viewerRole)) return false
  let meta = rawMsg.metadata
  if (typeof meta === 'string') {
    try {
      meta = JSON.parse(meta)
    } catch {
      meta = null
    }
  }
  if (!meta || typeof meta !== 'object' || meta.hidden_from_recipient !== true) return false
  const sid = rawMsg.sender_id ?? rawMsg.senderId
  if (sid != null && String(sid) === String(viewerUserId)) return false
  return true
}
