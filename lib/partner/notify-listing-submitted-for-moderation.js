/**
 * Stage 201.66 — admin Telegram when a listing is submitted for moderation (PENDING).
 * SSOT: call from partner listing PUT/PATCH after a successful transition → PENDING.
 * Do NOT call from the partner browser via `/api/v2/admin/telegram` (admin-staff only → 403).
 */

import { getPublicSiteUrl } from '@/lib/site-url.js'
import { sendToAdminTopic } from '@/lib/services/notifications/telegram.service.js'
import { mapListingPriceFieldsForApi } from '@/lib/listing/listing-base-price-canon.js'

/**
 * @param {{
 *   listing?: object | null,
 *   previousStatus?: string | null,
 *   nextStatus?: string | null,
 * }} params
 * @returns {Promise<{ success: boolean, skipped?: boolean, reason?: string }>}
 */
export async function notifyListingSubmittedForModeration({
  listing,
  previousStatus,
  nextStatus,
} = {}) {
  const prev = String(previousStatus || '').toUpperCase()
  const next = String(nextStatus || '').toUpperCase()
  if (next !== 'PENDING' || prev === 'PENDING') {
    return { success: false, skipped: true, reason: 'not_new_pending' }
  }
  if (!listing?.id) {
    return { success: false, skipped: true, reason: 'no_listing' }
  }

  const baseUrl = getPublicSiteUrl()
  const price = mapListingPriceFieldsForApi(listing)
  const amount = Number(price.basePriceThb) || 0
  const currency = String(price.baseCurrency || 'THB')
  const imagesCount = Array.isArray(listing.images) ? listing.images.filter(Boolean).length : 0
  const title = String(listing.title || 'Без названия').slice(0, 80)

  const message = [
    '🔔 <b>НОВОЕ ОБЪЯВЛЕНИЕ НА МОДЕРАЦИЮ</b>',
    '',
    `🏠 <b>Название:</b> ${title}`,
    `💰 <b>Цена:</b> ${amount.toLocaleString('ru-RU')} ${currency}/день`,
    `📸 <b>Фото:</b> ${imagesCount}`,
    `📍 <b>Район:</b> ${listing.district || 'Не указан'}`,
    `🆔 <code>${listing.id}</code>`,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    `<a href="${baseUrl}/admin/moderation">Открыть модерацию →</a>`,
  ].join('\n')

  try {
    const result = await sendToAdminTopic('NEW_PARTNERS', message)
    if (!result?.success) {
      console.warn('[listing-moderation-tg] send failed:', result?.error || result?.reason || result)
    }
    return result?.success ? { success: true } : { success: false, reason: result?.error || 'send_failed' }
  } catch (e) {
    console.warn('[listing-moderation-tg]', e?.message || e)
    return { success: false, reason: e?.message || 'exception' }
  }
}
