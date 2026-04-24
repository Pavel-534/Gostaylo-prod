/**
 * Stage 32.0 — откат `promo_codes.current_uses`, если бронь с полным возвратом отменена после учёта промо (PAID_ESCROW).
 * Идемпотентность: `booking.metadata.promo_usage_reverted_at`.
 */

import { supabaseAdmin } from '@/lib/supabase'

const FULL_REFUND_EPS_THB = 15

/**
 * @param {object} opts
 * @param {string} opts.bookingId
 * @param {string} opts.previousStatus
 * @param {number} opts.refundGuestThb
 * @param {number} opts.guestTotalThb
 * @param {object | null} opts.bookingBefore — строка до update (promo_code_used, metadata)
 * @returns {Promise<{ ok: boolean, skipped?: boolean, reason?: string }>}
 */
export async function revertPromoUsageAfterFullRefundCancel(opts) {
  const { bookingId, previousStatus, refundGuestThb, guestTotalThb, bookingBefore } = opts
  if (!supabaseAdmin || !bookingId || !bookingBefore) return { ok: true, skipped: true, reason: 'no_input' }

  if (String(previousStatus || '').toUpperCase() !== 'PAID_ESCROW') {
    return { ok: true, skipped: true, reason: 'not_from_escrow' }
  }

  const codeRaw = bookingBefore.promo_code_used
  if (!codeRaw || typeof codeRaw !== 'string') return { ok: true, skipped: true, reason: 'no_promo' }

  const meta =
    bookingBefore.metadata && typeof bookingBefore.metadata === 'object' && !Array.isArray(bookingBefore.metadata)
      ? bookingBefore.metadata
      : {}
  if (!meta.promo_usage_counted_at) return { ok: true, skipped: true, reason: 'never_counted' }
  if (meta.promo_usage_reverted_at) return { ok: true, skipped: true, reason: 'already_reverted' }

  const guestTotal = Number(guestTotalThb)
  const refund = Number(refundGuestThb)
  if (!Number.isFinite(guestTotal) || guestTotal <= 0) return { ok: true, skipped: true, reason: 'no_guest_total' }
  if (!Number.isFinite(refund) || refund < guestTotal - FULL_REFUND_EPS_THB) {
    return { ok: true, skipped: true, reason: 'not_full_refund' }
  }

  const normalized = codeRaw.trim().toUpperCase()

  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: promo, error: pe } = await supabaseAdmin
      .from('promo_codes')
      .select('id, current_uses')
      .eq('code', normalized)
      .maybeSingle()

    if (pe || !promo) return { ok: false, reason: 'promo_missing' }
    const cur = Math.max(0, Number(promo.current_uses) || 0)
    if (cur <= 0) {
      await supabaseAdmin
        .from('bookings')
        .update({
          metadata: {
            ...meta,
            promo_usage_reverted_at: new Date().toISOString(),
            promo_usage_reverted_reason: 'full_refund_cancel_zero_balance',
          },
        })
        .eq('id', bookingId)
      return { ok: true, skipped: true, reason: 'uses_already_zero' }
    }

    const next = cur - 1
    const { data: updated, error: ue } = await supabaseAdmin
      .from('promo_codes')
      .update({ current_uses: next })
      .eq('id', promo.id)
      .eq('current_uses', cur)
      .select('id')
      .maybeSingle()

    if (!ue && updated?.id) {
      const revertedAt = new Date().toISOString()
      const { error: be } = await supabaseAdmin
        .from('bookings')
        .update({
          metadata: {
            ...meta,
            promo_usage_reverted_at: revertedAt,
            promo_usage_reverted_code: normalized,
          },
        })
        .eq('id', bookingId)
      if (be) return { ok: false, reason: 'metadata_update' }
      return { ok: true }
    }
  }

  return { ok: false, reason: 'concurrency' }
}
