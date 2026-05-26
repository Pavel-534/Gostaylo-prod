/**
 * SSOT: мягкое предупреждение при обмене контактами в чате (ADVISORY; до оплаты).
 */

import { getUIText } from '@/lib/translations'
import { areContactsRevealedForBooking } from '@/lib/mask-contacts.js'
import { detectContactSafety } from '@/lib/chat/contact-safety-detection'

/** @param {string | null | undefined} bookingStatus */
export function shouldShowContactSafetyWarning(bookingStatus) {
  if (bookingStatus == null || bookingStatus === '') return true
  return !areContactsRevealedForBooking(bookingStatus)
}

/**
 * @param {string} [language]
 * @returns {string}
 */
export function getContactSafetyWarningCopy(language = 'ru') {
  return getUIText('chatSafety_warningText', language)
}

/**
 * @param {string} [language]
 * @returns {string}
 */
export function getContactSafetyWarningTitle(language = 'ru') {
  return getUIText('chatSafety_warningTitle', language)
}

/**
 * @param {object} opts
 * @param {string} [opts.language]
 * @param {{ error?: (title: string, opts?: object) => void } | ((message: string, opts?: object) => void)} [opts.toast] — sonner toast
 * @param {string | null | undefined} [opts.bookingStatus]
 * @param {number} [opts.duration]
 * @returns {boolean} — true если предупреждение показано
 */
export function showContactSafetyWarning({
  language = 'ru',
  toast,
  bookingStatus = null,
  duration = 14000,
} = {}) {
  if (!shouldShowContactSafetyWarning(bookingStatus)) return false

  const title = getContactSafetyWarningTitle(language)
  const description = getContactSafetyWarningCopy(language)

  if (toast && typeof toast.warning === 'function') {
    toast.warning(title, { description, duration })
    return true
  }
  if (toast && typeof toast.error === 'function') {
    toast.error(title, { description, duration })
    return true
  }
  if (typeof toast === 'function') {
    toast(`${title}\n${description}`, { duration })
    return true
  }

  return true
}

/**
 * @param {string} text
 * @param {string | null | undefined} bookingStatus
 * @returns {boolean}
 */
export function shouldWarnContactSafetyForText(text, bookingStatus = null) {
  if (!shouldShowContactSafetyWarning(bookingStatus)) return false
  const det = detectContactSafety(String(text || ''))
  return det.hasSafetyTrigger === true
}

/**
 * API / push payload for contact-safety advisory.
 * @param {string} [language]
 */
export function buildContactSafetyWarningPayload(language = 'ru') {
  return {
    code: 'CONTACT_SAFETY_WARNING',
    title: getContactSafetyWarningTitle(language),
    message: getContactSafetyWarningCopy(language),
  }
}
