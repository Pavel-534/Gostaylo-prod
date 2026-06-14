/**
 * Stage 23.0 — Admin Telegram pulse for renter emergency contact (booking-linked audit).
 */

import { sendToSupportTopic } from '@/lib/services/notifications/telegram.service.js'
import { getPublicSiteUrl } from '@/lib/site-url.js'

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * @param {{ health_or_safety?: boolean, no_property_access?: boolean, disaster?: boolean }} checklist
 * @returns {string}
 */
export function formatEmergencyChecklistRu(checklist) {
  const c = checklist && typeof checklist === 'object' ? checklist : {}
  const parts = []
  if (c.health_or_safety === true) parts.push('Здоровье или безопасность')
  if (c.no_property_access === true) parts.push('Нет доступа в жильё')
  if (c.disaster === true) parts.push('Авария (пожар, потоп и т.п.)')
  return parts.length ? parts.join(', ') : '—'
}

/**
 * Fire-and-forget: admin HQ Telegram (support topic when configured, else general group).
 *
 * @param {{ bookingId: string, listingTitle: string, checklist: object }} params
 */
export async function notifyAdminEmergencyTelegram({ bookingId, listingTitle, checklist }) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!process.env.TELEGRAM_ADMIN_GROUP_ID || !token) {
    console.warn('[emergency-contact] Telegram skip: TELEGRAM_ADMIN_GROUP_ID or TELEGRAM_BOT_TOKEN missing')
    return { success: false, skipped: true }
  }

  const base = (getPublicSiteUrl() || '').replace(/\/$/, '')
  const auditLink = `${base}/admin/bookings/${encodeURIComponent(String(bookingId))}`
  const reasons = formatEmergencyChecklistRu(checklist)

  const text =
    `🚨 <b>ЭКСТРЕННЫЙ ВЫЗОВ!</b>\n\n` +
    `<b>Бронь:</b> <code>${escHtml(bookingId)}</code>\n` +
    `<b>Объект:</b> ${escHtml(listingTitle)}\n` +
    `<b>Причина:</b> ${escHtml(reasons)}\n` +
    `<a href="${auditLink}">Ссылка на аудит</a>`

  const tg = await sendToSupportTopic(text, { disable_web_page_preview: true })
  if (!tg?.success) {
    console.warn('[emergency-contact] Telegram admin notify failed:', tg?.error || tg?.reason)
  }
  return tg
}
