/**
 * Stage 131.A1.2 — Guest L3 upline resolver + shadow persist + consent.
 * Mirror of referral-guest-l2-shadow.service.js. No live ledger writes here.
 */
import { supabaseAdmin } from '@/lib/supabase'
import { resolveGuestL3ReferrerId } from '@/lib/services/marketing/referral-guest-pool-payout-split.js'

export { resolveGuestL3ReferrerId }

function round2(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

/**
 * Fail-closed for L3 only. Missing column / missing row / DB error → no consent.
 * Never throws — L1/L2 must not depend on this.
 */
export async function beneficiaryHasConsent(userId) {
  const uid = String(userId || '').trim()
  if (!uid || !supabaseAdmin) return false
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('referral_mlm_consent_at')
      .eq('id', uid)
      .maybeSingle()
    if (error) {
      if (/does not exist|column/i.test(String(error.message || ''))) return false
      console.warn('[REFERRAL] L3 consent read:', error.message)
      return false
    }
    return Boolean(data?.referral_mlm_consent_at)
  } catch (e) {
    console.warn('[REFERRAL] L3 consent:', e?.message || e)
    return false
  }
}

/**
 * Persist unpaid L3 into booking.metadata.fintech_snapshot.shadow_l3_thb.
 * Overwrites (same as L2 shadow), after a fresh metadata read so L2 keys are kept.
 *
 * @param {string} bookingId
 * @param {{ shadowL3Thb: number, l3ReferrerId?: string, rawThb?: number, reason?: string, cappedByBooking?: boolean, cappedByMonthly?: boolean }} shadowResult
 */
export async function persistGuestL3ShadowToBooking(bookingId, shadowResult) {
  const id = String(bookingId || '').trim()
  const amount = round2(Number(shadowResult?.shadowL3Thb) || 0)
  if (!id || amount <= 0 || !supabaseAdmin) return { persisted: false }

  const { data, error: readErr } = await supabaseAdmin
    .from('bookings')
    .select('metadata')
    .eq('id', id)
    .maybeSingle()
  if (readErr) return { persisted: false, reason: readErr.message }

  const meta = data?.metadata && typeof data.metadata === 'object' ? { ...data.metadata } : {}
  const snap =
    meta.fintech_snapshot && typeof meta.fintech_snapshot === 'object'
      ? { ...meta.fintech_snapshot }
      : { v: 1 }

  snap.shadow_l3_thb = amount
  snap.shadow_l3_referrer_id = String(shadowResult?.l3ReferrerId || '').trim() || null
  snap.shadow_l3_mode = 'shadow'
  snap.shadow_l3_raw_thb = round2(Number(shadowResult?.rawThb) || amount)
  snap.shadow_l3_reason = String(shadowResult?.reason || 'L3_WITHHELD')
  snap.shadow_l3_capped_by_booking = shadowResult?.cappedByBooking === true
  snap.shadow_l3_capped_by_monthly = shadowResult?.cappedByMonthly === true
  snap.shadow_l3_computed_at = new Date().toISOString()

  const { error } = await supabaseAdmin
    .from('bookings')
    .update({ metadata: { ...meta, fintech_snapshot: snap }, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { persisted: false, reason: error.message }
  return { persisted: true, shadowL3Thb: amount }
}

export default {
  resolveGuestL3ReferrerId,
  beneficiaryHasConsent,
  persistGuestL3ShadowToBooking,
}
