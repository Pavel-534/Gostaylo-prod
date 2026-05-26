/**
 * Stage 116.0–116.1 — временный soft-hold календаря для INQUIRY (48–72h TTL).
 * Аналог invoice_hold; expired rows игнорируются в CalendarService.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { toListingDate } from '@/lib/listing-date'
import { resolveListingTimeZoneFromMetadata } from '@/lib/geo/listing-timezone-ssot'

export const INQUIRY_SOFT_HOLD_HOURS_MIN = 48
export const INQUIRY_SOFT_HOLD_HOURS_MAX = 72
/** @deprecated Prefer resolveInquirySoftHoldHours() — env INQUIRY_SOFT_HOLD_HOURS (48–72). */
export const INQUIRY_SOFT_HOLD_HOURS = INQUIRY_SOFT_HOLD_HOURS_MIN

/**
 * TTL soft-hold из env (clamp 48–72), default 48.
 * @returns {number}
 */
export function resolveInquirySoftHoldHours() {
  const raw = parseInt(String(process.env.INQUIRY_SOFT_HOLD_HOURS || ''), 10)
  if (!Number.isFinite(raw)) return INQUIRY_SOFT_HOLD_HOURS_MIN
  return Math.min(INQUIRY_SOFT_HOLD_HOURS_MAX, Math.max(INQUIRY_SOFT_HOLD_HOURS_MIN, raw))
}

/**
 * @param {string} [language]
 * @param {number} [holdHours]
 */
export function getInquirySoftHoldPartnerNotice(language = 'ru', holdHours = resolveInquirySoftHoldHours()) {
  const h = Math.max(1, holdHours)
  const copy = {
    ru: `Даты заявки временно зарезервированы на ${h} ч (до оплаты). При подтверждении проверьте календарь — другая заявка могла занять слот.`,
    en: `Inquiry dates are soft-held for ${h}h until payment. On confirm, recheck the calendar — another inquiry may conflict.`,
    zh: `询价日期已临时保留 ${h} 小时（付款前）。确认时请核对日历，可能与其他询价冲突。`,
    th: `วันที่คำขอถูกจองชั่วคราว ${h} ชม. (ก่อนชำระ) เมื่อยืนยัน ตรวจปฏิทิน — อาจชนกับคำขออื่น`,
  }
  return copy[language] || copy.en
}

export const INQUIRY_SOFT_HOLD_SOURCE = 'inquiry_hold'

/**
 * @param {object} params
 * @param {string} params.listingId
 * @param {string} params.bookingId
 * @param {string|Date} params.checkIn
 * @param {string|Date} params.checkOut
 * @param {number} [params.guestsCount]
 * @param {object} [params.listingMetadata]
 * @param {number} [params.holdHours]
 */
export async function createInquirySoftHold({
  listingId,
  bookingId,
  checkIn,
  checkOut,
  guestsCount = 1,
  listingMetadata = null,
  holdHours = resolveInquirySoftHoldHours(),
}) {
  const tz = resolveListingTimeZoneFromMetadata(listingMetadata)
  const startDate = toListingDate(checkIn, tz)
  const endDate = toListingDate(checkOut, tz)
  if (!startDate || !endDate || !listingId || !bookingId) {
    return { ok: false, error: 'INVALID_DATES' }
  }

  const holdMs = Math.max(1, holdHours) * 60 * 60 * 1000
  const expiresAt = new Date(Date.now() + holdMs).toISOString()
  const units = Math.max(1, parseInt(String(guestsCount), 10) || 1)

  const { error } = await supabaseAdmin.from('calendar_blocks').insert({
    listing_id: listingId,
    start_date: startDate,
    end_date: endDate,
    source: INQUIRY_SOFT_HOLD_SOURCE,
    units_blocked: units,
    reason: `Inquiry ${bookingId} — soft hold (${holdHours}h)`,
    expires_at: expiresAt,
  })

  if (error) {
    console.warn('[inquiry-soft-hold] insert failed:', error.message)
    return { ok: false, error: error.message }
  }

  return { ok: true, expiresAt }
}

/**
 * Снять soft-hold при confirm/cancel/expire inquiry.
 * @param {string} bookingId
 */
export async function releaseInquirySoftHold(bookingId) {
  if (!bookingId) return { ok: false, deleted: 0 }
  const needle = `Inquiry ${bookingId}`
  const { data, error } = await supabaseAdmin
    .from('calendar_blocks')
    .select('id')
    .eq('source', INQUIRY_SOFT_HOLD_SOURCE)
    .ilike('reason', `%${needle}%`)

  if (error) {
    console.warn('[inquiry-soft-hold] release list failed:', error.message)
    return { ok: false, deleted: 0, error: error.message }
  }

  const ids = (data || []).map((r) => r.id).filter(Boolean)
  if (!ids.length) return { ok: true, deleted: 0 }

  const { error: delErr } = await supabaseAdmin.from('calendar_blocks').delete().in('id', ids)
  if (delErr) {
    console.warn('[inquiry-soft-hold] release delete failed:', delErr.message)
    return { ok: false, deleted: 0, error: delErr.message }
  }

  return { ok: true, deleted: ids.length }
}
