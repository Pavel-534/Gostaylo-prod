/**
 * Stage 54.0 — shared helpers for notification handler clusters.
 */

import { getPublicSiteUrl, getSiteDisplayName } from '@/lib/site-url.js'
import { supabaseAdmin } from '@/lib/supabase'
import { normalizeEmailLang } from '@/lib/email/booking-email-i18n'

const BASE_URL = getPublicSiteUrl()

export const PAYMENT_METHOD_LABELS = {
  USDT_TRC20: 'USDT TRC-20',
  CARD_INTL: 'Card (Visa/MC)',
  CARD_RU: 'МИР',
  THAI_QR: 'Thai QR',
}

/** Fallback plain-text (RU): эскроу до подтверждения заселения — бренд из SSOT. */
export function escrowCheckInSecurityMessageRu() {
  const b = getSiteDisplayName()
  return `🔒 Ваши средства защищены системой Эскроу ${b} и выплачиваются владельцу только после подтверждения заселения.`
}

/** Изолирует сбой одного канала (email / tg / admin topic). */
export async function safeNotifyChannel(label, fn) {
  try {
    await fn()
  } catch (e) {
    console.error(`[NOTIFICATION channel:${label}]`, e)
  }
}

/** Ночи между датами (как в legacy NotificationService). */
export function calculateNights(checkIn, checkOut) {
  try {
    const start = new Date(checkIn)
    const end = new Date(checkOut)
    const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24))
    return diff > 0 ? diff : 1
  } catch {
    return 1
  }
}

/** Ссылка на диалог по брони или общий inbox. */
export async function buildGuestChatUrlForBooking(bookingId) {
  if (!bookingId || !supabaseAdmin) return `${BASE_URL}/messages/`
  try {
    const { data } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .eq('booking_id', bookingId)
      .maybeSingle()
    if (data?.id) return `${BASE_URL}/messages/${data.id}/`
  } catch (e) {
    console.warn('[NOTIFICATION] buildGuestChatUrlForBooking', e?.message || e)
  }
  return `${BASE_URL}/messages/`
}

export async function resolveGuestEmailLang(booking, guestProfile) {
  if (guestProfile?.language) return normalizeEmailLang(guestProfile.language)
  if (booking?.renter_id && supabaseAdmin) {
    try {
      const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('language')
        .eq('id', booking.renter_id)
        .maybeSingle()
      if (prof?.language) return normalizeEmailLang(prof.language)
    } catch (_) {
      /* ignore */
    }
  }
  return 'ru'
}
