/**
 * Stage 168.1 — notification_preferences SSOT (transactional vs marketing).
 */

/** @typedef {object} NotificationPreferences
 * @property {boolean} [email] — legacy transactional email
 * @property {boolean} [telegram]
 * @property {string|null} [telegramChatId]
 * @property {boolean} [marketing] — legacy marketing flag
 * @property {boolean} [marketing_email]
 * @property {boolean} [marketing_push]
 * @property {boolean} [transactional_email]
 * @property {boolean} [transactional_telegram]
 * @property {boolean} [telegram_guest_menu]
 */

export const DEFAULT_NOTIFICATION_PREFERENCES = Object.freeze({
  email: true,
  telegram: false,
  telegramChatId: null,
  marketing: false,
  marketing_email: false,
  marketing_push: false,
  transactional_email: true,
  transactional_telegram: true,
})

/**
 * @param {NotificationPreferences | null | undefined} raw
 * @returns {NotificationPreferences}
 */
export function normalizeNotificationPreferences(raw) {
  const base = { ...DEFAULT_NOTIFICATION_PREFERENCES }
  if (!raw || typeof raw !== 'object') return base

  const marketing =
    raw.marketing_email === true ||
    raw.marketing === true ||
    raw.marketing_push === true

  return {
    ...base,
    ...raw,
    email: raw.email !== false,
    telegram: raw.telegram === true,
    telegramChatId: raw.telegramChatId ?? null,
    marketing,
    marketing_email: raw.marketing_email === true || raw.marketing === true,
    marketing_push: raw.marketing_push === true,
    transactional_email:
      raw.transactional_email !== false && raw.email !== false,
    transactional_telegram:
      raw.transactional_telegram !== false && raw.telegram !== false,
  }
}

/**
 * @param {NotificationPreferences | null | undefined} current
 * @param {Record<string, unknown>} incoming
 * @returns {NotificationPreferences}
 */
export function mergeNotificationPreferences(current, incoming) {
  const prev = normalizeNotificationPreferences(current)
  const next = { ...prev, ...incoming }

  if (incoming.marketing !== undefined) {
    next.marketing = incoming.marketing === true
    next.marketing_email = incoming.marketing === true
  }
  if (incoming.marketing_email !== undefined) {
    next.marketing_email = incoming.marketing_email === true
    next.marketing = next.marketing_email || next.marketing_push
  }
  if (incoming.marketing_push !== undefined) {
    next.marketing_push = incoming.marketing_push === true
    next.marketing = next.marketing_email || next.marketing_push
  }
  if (incoming.transactional_email !== undefined) {
    next.transactional_email = incoming.transactional_email !== false
    next.email = next.transactional_email
  }
  if (incoming.transactional_telegram !== undefined) {
    next.transactional_telegram = incoming.transactional_telegram !== false
  }
  if (incoming.telegram !== undefined) {
    next.telegram = incoming.telegram === true
  }
  if (incoming.email !== undefined) {
    next.email = incoming.email !== false
    if (incoming.transactional_email === undefined) {
      next.transactional_email = next.email
    }
  }

  return normalizeNotificationPreferences(next)
}
