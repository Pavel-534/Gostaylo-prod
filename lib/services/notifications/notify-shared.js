/**
 * Stage 54.0 — shared helpers for notification handler clusters.
 */

import { getPublicSiteUrl, getSiteDisplayName } from '@/lib/site-url.js'
import { supabaseAdmin } from '@/lib/supabase'

const BASE_URL = getPublicSiteUrl()

export const PAYMENT_METHOD_LABELS = {
  USDT_TRC20: 'USDT TRC-20',
  CARD_INTL: 'Card (Visa/MC)',
  CARD_RU: 'МИР',
  THAI_QR: 'Thai QR',
}

import { escrowCheckInSecurityMessage as escrowMsgForLang } from '@/lib/services/notifications/notify-telegram-copy.js'

/** Fallback plain-text (RU): эскроу до подтверждения заселения — бренд из SSOT. */
export function escrowCheckInSecurityMessageRu() {
  return escrowMsgForLang('ru')
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
  const { resolveGuestNotifyLocale } = await import('@/lib/i18n/resolve-notify-locale.js')
  return resolveGuestNotifyLocale(booking, guestProfile)
}
