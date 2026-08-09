/**
 * Stage 200.79 — Instant Book × iCal circuit breaker (server-only: TG / alerts / telemetry).
 */

import * as Tg from '@/lib/services/notifications/telegram.service.js'
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'
import { getSiteDisplayName } from '@/lib/site-url.js'
import { logStructured } from '@/lib/critical-telemetry.js'
import {
  EXCLUSIVE_MANUAL_CALENDAR_META_KEY,
  ICAL_INSTANT_BREAKER_STALE_MS,
  assertInstantBookingCalendarPolicy,
  hasExclusiveManualCalendarAck,
  isPartnerIcalFeedError,
  isPlatformIcalSyncError,
  listingHasEnabledIcalSources,
} from '@/lib/ical/instant-booking-ical-policy.js'

export {
  EXCLUSIVE_MANUAL_CALENDAR_META_KEY,
  ICAL_INSTANT_BREAKER_STALE_MS,
  assertInstantBookingCalendarPolicy,
  hasExclusiveManualCalendarAck,
  isPartnerIcalFeedError,
  isPlatformIcalSyncError,
  listingHasEnabledIcalSources,
}

/**
 * Disable Instant Book after partner iCal feed failure; notify partner TG when possible.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *   listingId: string,
 *   ownerId?: string|null,
 *   listingTitle?: string|null,
 *   sourceUrl?: string|null,
 *   errorMessage?: string|null,
 *   priorMetadata?: object|null,
 * }} args
 */
export async function tripInstantBookingIcalCircuitBreaker(supabase, args) {
  const listingId = String(args.listingId || '').trim()
  if (!listingId || !supabase) return { tripped: false, reason: 'no_listing' }

  const errorMessage = String(args.errorMessage || 'iCal sync failed')
  const sourceUrl = String(args.sourceUrl || '').trim()
  const nowIso = new Date().toISOString()

  const { data: row } = await supabase
    .from('listings')
    .select('id, owner_id, title, instant_booking, metadata')
    .eq('id', listingId)
    .maybeSingle()

  if (!row || row.instant_booking !== true) {
    return { tripped: false, reason: 'not_instant' }
  }

  const priorMeta =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? row.metadata
      : args.priorMetadata && typeof args.priorMetadata === 'object'
        ? args.priorMetadata
        : {}

  const nextMeta = {
    ...priorMeta,
    ical_circuit_breaker: {
      at: nowIso,
      reason: errorMessage,
      source_url: sourceUrl || null,
      action: 'instant_booking_disabled',
    },
  }

  const { error: updErr } = await supabase
    .from('listings')
    .update({
      instant_booking: false,
      metadata: nextMeta,
      updated_at: nowIso,
    })
    .eq('id', listingId)
    .eq('instant_booking', true)

  if (updErr) {
    console.error('[ICAL-IB-GUARD] disable failed', listingId, updErr.message)
    void notifySystemAlert(
      `⚠️ <b>iCal Instant Book guard</b> — не удалось выключить IB\n` +
        `<code>${escapeSystemAlertHtml(listingId)}</code>\n` +
        `<code>${escapeSystemAlertHtml(updErr.message)}</code>`,
    )
    return { tripped: false, reason: 'update_failed', error: updErr.message }
  }

  logStructured('warn', {
    event: 'ical_instant_booking_circuit_breaker',
    listing_id: listingId,
    source_url: sourceUrl || null,
    error_message: errorMessage,
  })

  const ownerId = args.ownerId || row.owner_id
  const title = args.listingTitle || row.title || listingId
  if (ownerId) {
    const { data: owner } = await supabase
      .from('profiles')
      .select('id, telegram_id, preferred_language, language')
      .eq('id', ownerId)
      .maybeSingle()

    const tg = owner?.telegram_id
    if (tg) {
      const brand = getSiteDisplayName()
      const lang = String(owner.preferred_language || owner.language || 'ru').toLowerCase()
      const isEn = lang.startsWith('en')
      const text = isEn
        ? `⚠️ <b>Instant booking turned off</b>\n\n` +
          `Listing: ${escapeSystemAlertHtml(title)}\n` +
          `Reason: your iCal feed failed (${escapeSystemAlertHtml(errorMessage)}).\n` +
          (sourceUrl ? `URL: <code>${escapeSystemAlertHtml(sourceUrl)}</code>\n` : '') +
          `\nFix the calendar link or mark the listing as exclusive/manual in ${escapeSystemAlertHtml(brand)}, then turn Instant booking back on.`
        : `⚠️ <b>Мгновенное бронирование выключено</b>\n\n` +
          `Объявление: ${escapeSystemAlertHtml(title)}\n` +
          `Причина: ошибка вашей iCal-ссылки (${escapeSystemAlertHtml(errorMessage)}).\n` +
          (sourceUrl ? `URL: <code>${escapeSystemAlertHtml(sourceUrl)}</code>\n` : '') +
          `\nИсправьте ссылку календаря или подтвердите «веду календарь вручную / эксклюзивно на ${escapeSystemAlertHtml(brand)}», затем снова включите мгновенное бронирование.`

      try {
        await Tg.sendTelegramMessagePayload({ chat_id: tg, text })
      } catch (e) {
        console.warn('[ICAL-IB-GUARD] partner TG failed', e?.message || e)
      }
    }
  }

  return { tripped: true, listingId }
}
