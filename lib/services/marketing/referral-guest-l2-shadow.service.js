/**
 * Stage 131.1 — L2 guest booking shadow accrual (no ledger until flag on).
 */
import { supabaseAdmin } from '@/lib/supabase'
import { ReferralPolicyService } from '@/lib/services/marketing/referral-policy.service.js'
import { round2, safeJsonArray } from '@/lib/services/marketing/referral-calculation.js'

function monthStartUtcIso(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString()
}

/**
 * L2 upline = ancestor_path[-2] (same convention as host activation MLM).
 * @param {object | null} relation
 */
export function resolveGuestL2ReferrerId(relation) {
  const l1 = String(relation?.referrer_id || '').trim()
  const ancestorIds = safeJsonArray(relation?.ancestor_path)
    .map((v) => String(v || '').trim())
    .filter(Boolean)
  const l2 = ancestorIds.length >= 2 ? ancestorIds[ancestorIds.length - 2] : null
  if (!l2 || l2 === l1) return null
  return l2
}

/**
 * Raw L2 share from guest pool percents (12% at launch preset).
 */
export function computeRawGuestL2ShadowThb(referralPoolThb, policy) {
  const pool = round2(Math.max(0, referralPoolThb))
  const pct = Number(policy?.ambassadorGuestPoolL2Percent ?? 12)
  return round2((pool * pct) / 100)
}

/**
 * Sum shadow L2 already recorded for mentor in UTC month (from booking metadata only).
 * SSOT: shadow path — never read `referral_ledger`. For live caps use `referral-guest-l2-live.service.js`.
 */
export async function getMonthlyGuestL2ShadowSpentThb(l2ReferrerId, monthStartIso = monthStartUtcIso()) {
  const l2Id = String(l2ReferrerId || '').trim()
  if (!l2Id) return 0

  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select('metadata, completed_at')
    .eq('status', 'COMPLETED')
    .gte('completed_at', monthStartIso)

  if (error) {
    if (String(error.message || '').includes('does not exist')) return 0
    throw new Error(error.message || 'SHADOW_L2_MONTHLY_READ_FAILED')
  }

  return round2(
    (data || []).reduce((acc, row) => {
      const snap = row?.metadata?.fintech_snapshot
      if (!snap || typeof snap !== 'object') return acc
      if (String(snap.shadow_l2_referrer_id || '') !== l2Id) return acc
      return acc + (Number(snap.shadow_l2_thb) || 0)
    }, 0),
  )
}

/**
 * Apply per-booking and monthly caps.
 */
export async function resolveGuestL2ShadowAccrual({
  referralPoolThb,
  policy,
  l2ReferrerId,
  at = new Date(),
}) {
  const l2Id = String(l2ReferrerId || '').trim()
  if (!l2Id) {
    return { applicable: false, reason: 'NO_L2_REFERRER', shadowL2Thb: 0 }
  }
  if (policy?.ambassadorGuestL2Enabled === true) {
    return { applicable: false, reason: 'L2_LIVE_ENABLED', shadowL2Thb: 0 }
  }

  const rawThb = computeRawGuestL2ShadowThb(referralPoolThb, policy)
  if (rawThb <= 0) {
    return { applicable: false, reason: 'ZERO_POOL_L2', shadowL2Thb: 0, rawThb: 0 }
  }

  const perBookingCap = round2(Math.max(0, Number(policy?.ambassadorGuestL2MaxThbPerBooking ?? 500)))
  const monthlyCap = round2(Math.max(0, Number(policy?.ambassadorGuestL2MaxThbPerMonth ?? 50_000)))
  const afterBookingCap = perBookingCap > 0 ? round2(Math.min(rawThb, perBookingCap)) : rawThb

  const monthStartIso = monthStartUtcIso(at)
  const monthlySpentBefore = await getMonthlyGuestL2ShadowSpentThb(l2Id, monthStartIso)
  const monthlyRemaining = round2(Math.max(0, monthlyCap - monthlySpentBefore))
  let shadowL2Thb = afterBookingCap
  let cappedByMonthly = false
  if (monthlyCap > 0 && shadowL2Thb > monthlyRemaining) {
    shadowL2Thb = round2(Math.max(0, monthlyRemaining))
    cappedByMonthly = true
  }

  return {
    applicable: shadowL2Thb > 0,
    reason: shadowL2Thb > 0 ? 'SHADOW_ACCRUAL' : 'MONTHLY_CAP_EXhaustED',
    mode: 'shadow',
    l2ReferrerId: l2Id,
    rawThb,
    shadowL2Thb,
    perBookingCapThb: perBookingCap,
    monthlyCapThb: monthlyCap,
    monthlySpentBeforeThb: monthlySpentBefore,
    cappedByBooking: perBookingCap > 0 && rawThb > perBookingCap,
    cappedByMonthly,
    monthStartIso,
    computedAt: new Date().toISOString(),
  }
}

/**
 * Persist shadow L2 into booking.metadata.fintech_snapshot (no ledger).
 */
export async function persistGuestL2ShadowToBooking(bookingId, existingMetadata, shadowResult) {
  const id = String(bookingId || '').trim()
  if (!id || !shadowResult?.applicable) return { persisted: false }

  const meta = existingMetadata && typeof existingMetadata === 'object' ? { ...existingMetadata } : {}
  const snap =
    meta.fintech_snapshot && typeof meta.fintech_snapshot === 'object'
      ? { ...meta.fintech_snapshot }
      : { v: 1 }

  snap.shadow_l2_thb = shadowResult.shadowL2Thb
  snap.shadow_l2_referrer_id = shadowResult.l2ReferrerId
  snap.shadow_l2_mode = 'shadow'
  snap.shadow_l2_raw_thb = shadowResult.rawThb
  snap.shadow_l2_capped_by_booking = shadowResult.cappedByBooking === true
  snap.shadow_l2_capped_by_monthly = shadowResult.cappedByMonthly === true
  snap.shadow_l2_computed_at = shadowResult.computedAt

  const nextMeta = { ...meta, fintech_snapshot: snap }
  const { error } = await supabaseAdmin
    .from('bookings')
    .update({ metadata: nextMeta, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { persisted: false, reason: error.message }
  return { persisted: true, shadowL2Thb: shadowResult.shadowL2Thb }
}

export default {
  resolveGuestL2ReferrerId,
  computeRawGuestL2ShadowThb,
  getMonthlyGuestL2ShadowSpentThb,
  resolveGuestL2ShadowAccrual,
  persistGuestL2ShadowToBooking,
}
