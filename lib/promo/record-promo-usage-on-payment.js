/**
 * Stage 31.0 — инкремент `promo_codes.current_uses` после успешной оплаты (PAID_ESCROW).
 * Идемпотентность: `booking.metadata.promo_usage_counted_at`.
 */

import { supabaseAdmin } from '@/lib/supabase'

/**
 * @param {string} bookingId
 * @returns {Promise<{ ok: boolean, skipped?: boolean, reason?: string }>}
 */
export async function recordPromoUsageAfterEscrowPaid(bookingId) {
  if (!supabaseAdmin || !bookingId) return { ok: true, skipped: true, reason: 'no_db' }

  const { data: row, error } = await supabaseAdmin
    .from('bookings')
    .select('id, status, promo_code_used, metadata')
    .eq('id', bookingId)
    .maybeSingle()

  if (error || !row) return { ok: false, reason: 'booking_fetch' }
  if (String(row.status || '').toUpperCase() !== 'PAID_ESCROW') {
    return { ok: true, skipped: true, reason: 'not_escrow' }
  }
  const codeRaw = row.promo_code_used
  if (!codeRaw || typeof codeRaw !== 'string') return { ok: true, skipped: true, reason: 'no_promo' }

  const meta = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? row.metadata : {}
  if (meta.promo_usage_counted_at) return { ok: true, skipped: true, reason: 'already_counted' }

  const normalized = codeRaw.trim().toUpperCase()

  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: promo, error: pe } = await supabaseAdmin
      .from('promo_codes')
      .select('id, current_uses, max_uses')
      .eq('code', normalized)
      .maybeSingle()

    if (pe || !promo) {
      return { ok: false, reason: 'promo_missing' }
    }

    const cur = Number(promo.current_uses) || 0
    if (promo.max_uses != null && cur >= Number(promo.max_uses)) {
      return { ok: true, skipped: true, reason: 'already_at_limit' }
    }

    const next = cur + 1
    const { data: updated, error: ue } = await supabaseAdmin
      .from('promo_codes')
      .update({ current_uses: next })
      .eq('id', promo.id)
      .eq('current_uses', cur)
      .select('id')
      .maybeSingle()

    if (!ue && updated?.id) {
      const countedAt = new Date().toISOString()
      const { error: be } = await supabaseAdmin
        .from('bookings')
        .update({
          metadata: {
            ...meta,
            promo_usage_counted_at: countedAt,
            promo_usage_counted_code: normalized,
          },
        })
        .eq('id', bookingId)

      if (be) return { ok: false, reason: 'metadata_update' }
      return { ok: true }
    }
  }

  return { ok: false, reason: 'concurrency' }
}
