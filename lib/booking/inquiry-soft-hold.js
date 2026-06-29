/**
 * Stage 116.0–175.3 — inquiry calendar soft-hold.
 * Stage 175.3.0: inquiries no longer insert `inquiry_hold` blocks (Airbnb-style; first paid wins).
 * `releaseInquirySoftHold` cleans legacy rows on confirm/cancel/invoice/cron.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { INQUIRY_HOLD_SOURCE } from '@/lib/calendar/block-source-display.js'

export const INQUIRY_SOFT_HOLD_HOURS_MIN = 48
export const INQUIRY_SOFT_HOLD_HOURS_MAX = 72
/** @deprecated Stage 175.3 — holds disabled; kept for env compat only. */
export const INQUIRY_SOFT_HOLD_HOURS = INQUIRY_SOFT_HOLD_HOURS_MIN

/**
 * @deprecated Stage 175.3 — inquiry holds disabled.
 * @returns {number}
 */
export function resolveInquirySoftHoldHours() {
  const raw = parseInt(String(process.env.INQUIRY_SOFT_HOLD_HOURS || ''), 10)
  if (!Number.isFinite(raw)) return INQUIRY_SOFT_HOLD_HOURS_MIN
  return Math.min(INQUIRY_SOFT_HOLD_HOURS_MAX, Math.max(INQUIRY_SOFT_HOLD_HOURS_MIN, raw))
}

/**
 * @deprecated Stage 175.3 — inquiries no longer reserve calendar inventory.
 * @param {string} [language]
 * @param {number} [_holdHours]
 */
export function getInquirySoftHoldPartnerNotice(language = 'ru', _holdHours = resolveInquirySoftHoldHours()) {
  const copy = {
    ru: 'Даты запроса не зарезервированы — слот закрепится за гостем, который первым оплатит счёт.',
    en: 'Inquiry dates are not held — the slot goes to whoever pays the invoice first.',
    zh: '询价日期未预留 — 谁先付款谁获得档期。',
    th: 'วันที่คำขอไม่ถูกจอง — ผู้ชำระใบแจ้งหนี้ก่อนได้สล็อต',
  }
  return copy[language] || copy.en
}

/** @deprecated Use INQUIRY_HOLD_SOURCE from `@/lib/calendar/block-source-display.js` */
export const INQUIRY_SOFT_HOLD_SOURCE = INQUIRY_HOLD_SOURCE

/**
 * Stage 175.3.0 — no-op: inquiries must not block catalog availability.
 * @param {object} _params
 */
export async function createInquirySoftHold(_params) {
  return { ok: true, skipped: true, expiresAt: null }
}

/**
 * Снять legacy soft-hold при confirm/cancel/expire inquiry / invoice.
 * @param {string} bookingId
 */
export async function releaseInquirySoftHold(bookingId) {
  if (!bookingId) return { ok: false, deleted: 0 }
  const needle = `Inquiry ${bookingId}`
  const { data, error } = await supabaseAdmin
    .from('calendar_blocks')
    .select('id')
    .eq('source', INQUIRY_HOLD_SOURCE)
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
