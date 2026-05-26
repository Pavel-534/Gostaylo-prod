/**
 * SSOT: нужно ли маскировать контакты в тексте сообщения при отображении.
 * В режиме ADVISORY — не маскируем (только предупреждение + strikes).
 */

import { areContactsRevealedForBooking } from '@/lib/mask-contacts.js'
import { shouldMaskContactsOnRead } from '@/lib/contact-safety-mode.js'

/**
 * @param {object} opts
 * @param {string|null|undefined} opts.viewerRole — admin/moderator видит всё
 * @param {string|null|undefined} opts.viewerUserId
 * @param {string|null|undefined} opts.senderId
 * @param {string|null|undefined} opts.bookingStatus
 * @param {string|null|undefined} opts.messageType
 * @param {boolean|undefined} opts.maskOverride — явный флаг с API
 * @returns {boolean}
 */
export function resolveShouldMaskMessageContacts(opts = {}) {
  const {
    viewerRole = null,
    viewerUserId = null,
    senderId = null,
    bookingStatus = null,
    messageType = 'text',
    maskOverride,
  } = opts

  if (!shouldMaskContactsOnRead()) return false

  const role = String(viewerRole || '').toLowerCase()
  if (role === 'admin' || role === 'moderator') return false

  const isOwnMessage = viewerUserId != null && String(senderId) === String(viewerUserId)
  if (isOwnMessage) return false

  const noTextTypes = new Set(['voice', 'image', 'file', 'invoice', 'system'])
  if (noTextTypes.has(String(messageType || '').toLowerCase())) return false

  if (typeof maskOverride === 'boolean') return maskOverride

  if (bookingStatus != null) {
    return !areContactsRevealedForBooking(bookingStatus)
  }

  // Без контекста брони — не раскрываем контакты (listing inquiry / pre-booking чат).
  return true
}
