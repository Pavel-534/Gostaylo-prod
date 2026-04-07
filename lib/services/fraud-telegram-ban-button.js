import { getPublicSiteUrl } from '@/lib/site-url.js'
import { createTelegramBanLinkToken } from '@/lib/auth/telegram-ban-link.js'

/**
 * Inline URL keyboard for Telegram system alerts ([FRAUD_DETECTION]).
 * @param {string | null | undefined} userId — profiles.id / auth user id
 * @returns {Record<string, unknown> | undefined}
 */
export function buildFraudBanReplyMarkup(userId) {
  const uid = userId != null ? String(userId).trim() : ''
  if (!uid || uid === '—' || uid === '-') return undefined
  let token
  try {
    token = createTelegramBanLinkToken(uid)
  } catch {
    return undefined
  }
  const url = `${getPublicSiteUrl()}/api/v2/admin/users/ban?t=${encodeURIComponent(token)}`
  return {
    inline_keyboard: [[{ text: `Забанить пользователя ${uid}`, url }]],
  }
}
