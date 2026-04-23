/**
 * Stage 23.0 — Admin Telegram pulse for renter emergency contact (booking-linked audit).
 */

import { sendMessage } from '@/lib/telegram'
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
  const adminGroupId = process.env.TELEGRAM_ADMIN_GROUP_ID
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!adminGroupId || !token) {
    console.warn('[emergency-contact] Telegram skip: TELEGRAM_ADMIN_GROUP_ID or TELEGRAM_BOT_TOKEN missing')
    return { ok: false, skipped: true }
  }

  const rawTopic = process.env.TELEGRAM_SUPPORT_TOPIC_ID
  let threadId = null
  if (rawTopic != null && String(rawTopic).trim() !== '') {
    const parsed = parseInt(String(rawTopic).trim(), 10)
    if (Number.isFinite(parsed) && parsed > 0) threadId = parsed
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

  const opts = threadId ? { message_thread_id: threadId, disable_web_page_preview: true } : { disable_web_page_preview: true }
  const tg = await sendMessage(adminGroupId, text, opts)
  if (!tg?.ok) {
    console.warn('[emergency-contact] Telegram admin notify failed:', tg?.description || tg?.error)
  }
  return tg
}
