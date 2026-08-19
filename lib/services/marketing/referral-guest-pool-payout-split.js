/**
 * Guest pool live split (L1/L2/L3/referee). Leaf — no Next / pricing imports.
 * Stage 131.A1.2: L3 is carved from the pool only when ambassadorGuestL3Enabled.
 * Unpaid L3 is withheld to the owner (same as L2 shadow), never added to referee.
 */

import { FINTECH_JS_DEFAULTS } from '@/lib/config/fintech-config-defaults.js'

function round2(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function resolveGuestPoolPercents(config) {
  if (!config?.ambassadorGuestL2Enabled) {
    const l1 = round2(Number(config?.referralSplitRatio || 0) * 100)
    return {
      l1Percent: l1,
      l2Percent: 0,
      l3Percent: 0,
      refereePercent: round2(100 - l1),
      mode: 'legacy_split_ratio',
    }
  }
  const l3Enabled = config?.ambassadorGuestL3Enabled === true
  const l3Percent = l3Enabled ? Number(config?.ambassadorGuestPoolL3Percent || 0) : 0
  return {
    l1Percent: Number(config?.ambassadorGuestPoolL1Percent),
    l2Percent: Number(config?.ambassadorGuestPoolL2Percent),
    l3Percent,
    refereePercent: Number(config?.ambassadorGuestPoolRefereePercent),
    mode: l3Enabled ? 'ambassador_3_l3' : 'ambassador_3_45_12_43',
  }
}

/**
 * Sync split of a guest referral pool. Gate/consent/caps are applied later in payout.
 *
 * @param {number} referralPoolThb
 * @param {object} config camelCase fintech policy
 */
export function deriveGuestPoolSplit(referralPoolThb, config) {
  const pool = round2(Math.max(0, referralPoolThb))
  const split = resolveGuestPoolPercents(config)
  const l1AmountThb = round2((pool * split.l1Percent) / 100)
  const l2AmountThb = round2((pool * split.l2Percent) / 100)
  const l3AmountThb = round2((pool * split.l3Percent) / 100)
  const refereeAmountThb = round2((pool * split.refereePercent) / 100)
  const drift = round2(pool - l1AmountThb - l2AmountThb - l3AmountThb - refereeAmountThb)
  return {
    poolThb: pool,
    splitMode: split.mode,
    l1AmountThb: round2(l1AmountThb + (split.l2Percent === 0 ? drift : 0)),
    l2AmountThb,
    l3AmountThb,
    l3WithheldThb: 0,
    refereeAmountThb: round2(refereeAmountThb + (split.l2Percent > 0 ? drift : 0)),
    l1Percent: split.l1Percent,
    l2Percent: split.l2Percent,
    l3Percent: split.l3Percent,
    refereePercent: split.refereePercent,
  }
}

/**
 * Live ledger amounts. L2 flag off → withhold L2 to owner (ADR-131). L3 is not carved
 * unless L2 is live (L3 percents only exist in the 42/10/5/43 envelope).
 */
export function resolveLiveGuestPoolPayout(referralPoolThb, policy) {
  const grossPoolThb = round2(Math.max(0, referralPoolThb))

  if (policy?.ambassadorGuestL2Enabled === true) {
    const split = deriveGuestPoolSplit(grossPoolThb, policy)
    return {
      splitMode: 'live_l2_enabled',
      grossPoolThb,
      payablePoolThb: grossPoolThb,
      referrerAmountThb: split.l1AmountThb,
      refereeAmountThb: split.refereeAmountThb,
      l2AmountThb: split.l2AmountThb,
      l2WithheldThb: 0,
      l3AmountThb: split.l3AmountThb,
      l3WithheldThb: 0,
      l1Percent: split.l1Percent,
      l2Percent: split.l2Percent,
      l3Percent: split.l3Percent,
      refereePercent: split.refereePercent,
    }
  }

  const l1Pct = Number(
    policy?.ambassadorGuestPoolL1Percent ?? FINTECH_JS_DEFAULTS.ambassadorGuestPoolL1Percent,
  )
  const l2Pct = Number(
    policy?.ambassadorGuestPoolL2Percent ?? FINTECH_JS_DEFAULTS.ambassadorGuestPoolL2Percent,
  )
  const guestPct = Number(
    policy?.ambassadorGuestPoolRefereePercent ?? FINTECH_JS_DEFAULTS.ambassadorGuestPoolRefereePercent,
  )
  const referrerAmountThb = round2((grossPoolThb * l1Pct) / 100)
  const l2WithheldThb = round2((grossPoolThb * l2Pct) / 100)
  const refereeAmountThb = round2(grossPoolThb - referrerAmountThb - l2WithheldThb)

  return {
    splitMode: 'shadow_l2_withheld',
    grossPoolThb,
    payablePoolThb: round2(referrerAmountThb + refereeAmountThb),
    referrerAmountThb,
    refereeAmountThb,
    l2AmountThb: 0,
    l2WithheldThb,
    l3AmountThb: 0,
    l3WithheldThb: 0,
    l1Percent: l1Pct,
    l2Percent: l2Pct,
    l3Percent: 0,
    refereePercent: guestPct,
  }
}

/**
 * Eligibility for a live L3 ledger row (sync). Shadow vs silent withhold is the caller's job.
 */
export function resolveL3AccrualEligibility({
  l3Enabled,
  l3ReferrerId,
  hasConsent,
  partnerCount,
  minDirectPartners,
} = {}) {
  if (l3Enabled !== true) {
    return { pay: false, writeShadow: false, reason: 'L3_DISABLED' }
  }
  if (!String(l3ReferrerId || '').trim()) {
    return { pay: false, writeShadow: false, reason: 'NO_L3_REFERRER' }
  }
  if (!hasConsent) {
    return { pay: false, writeShadow: true, reason: 'L3_CONSENT_FAIL' }
  }
  const min = Math.max(0, Math.floor(Number(minDirectPartners) || 0))
  const count = Math.max(0, Math.floor(Number(partnerCount) || 0))
  if (count < min) {
    return { pay: false, writeShadow: true, reason: 'L3_GATE_FAIL' }
  }
  return { pay: true, writeShadow: false, reason: 'OK' }
}

/**
 * Per-booking + monthly caps for L3 (same shape as live L2).
 * deferredAmountThb = raw − final (owner withhold / shadow).
 */
export function applyL3BookingAndMonthlyCaps({
  rawThb,
  perBookingCap,
  monthlySpentThb,
  monthlyCap,
} = {}) {
  const raw = round2(Math.max(0, rawThb))
  const bookingCap = round2(Math.max(0, Number(perBookingCap) || 0))
  const afterBookingCapThb = bookingCap > 0 ? round2(Math.min(raw, bookingCap)) : raw
  const monthlyCapThb = round2(Math.max(0, Number(monthlyCap) || 0))
  const spent = round2(Math.max(0, Number(monthlySpentThb) || 0))
  const monthlyRemainingThb =
    monthlyCapThb > 0 ? round2(Math.max(0, monthlyCapThb - spent)) : afterBookingCapThb
  const finalThb =
    monthlyCapThb > 0 ? round2(Math.min(afterBookingCapThb, monthlyRemainingThb)) : afterBookingCapThb
  return {
    finalThb,
    deferredAmountThb: round2(Math.max(0, raw - finalThb)),
    afterBookingCapThb,
    monthlyRemainingThb,
    cappedByBooking: bookingCap > 0 && raw > bookingCap,
    cappedByMonthly: monthlyCapThb > 0 && afterBookingCapThb > monthlyRemainingThb,
  }
}

function safeJsonArray(value) {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed
    } catch {
      return []
    }
  }
  return []
}

/**
 * L3 upline = ancestor_path[length-3]. No mentor_l2_user_id on referral_relations.
 * Tree A→B→C→guest: path [A,B,C], L1=C, L2=B, L3=A.
 */
export function resolveGuestL3ReferrerId(relation) {
  const l1 = String(relation?.referrer_id || '').trim()
  if (!l1) return null
  const ancestorIds = safeJsonArray(relation?.ancestor_path)
    .map((v) => String(v || '').trim())
    .filter(Boolean)
  const l2 = ancestorIds.length >= 2 ? ancestorIds[ancestorIds.length - 2] : null
  if (ancestorIds.length < 3) return null
  const l3 = ancestorIds[ancestorIds.length - 3]
  if (!l3) return null
  if (l3 === l1) return null
  if (l2 && l3 === l2) return null
  return l3
}

export { round2 }
