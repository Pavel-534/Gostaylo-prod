/**
 * Server-side booking price integrity + checkout attestation SSOT (Stage 100).
 * v2: `pricing_snapshot.final_breakdown` + Math.round to 1 THB.
 * Legacy: pot10 (ceil to 10 THB) for pre-v2 snapshots only.
 */

import {
  computeRoundedGuestTotal,
  ROUNDING_MODE_INTEGER,
  ROUNDING_MODE_POT10,
} from '@/lib/booking-guest-rounding'

export { ROUNDING_MODE_INTEGER, ROUNDING_MODE_POT10, computeRoundedGuestTotal }

/** Минимальная сумма к оплате гостем (субтотал проживания + сервисный сбор), THB */
export const MIN_BOOKING_GUEST_TOTAL_THB = 100

/**
 * @param {object | null | undefined} pricingSnapshot
 */
export function isPricingSnapshotV2(pricingSnapshot) {
  const snap = pricingSnapshot && typeof pricingSnapshot === 'object' ? pricingSnapshot : null
  if (!snap) return false
  if (Number(snap.v) >= 2 && snap.final_breakdown && typeof snap.final_breakdown === 'object') {
    return true
  }
  return false
}

/**
 * Canonical rounded guest total from immutable v2 snapshot.
 * @param {object | null | undefined} pricingSnapshot
 * @returns {number | null}
 */
export function guestRoundedTotalFromSnapshotV2(pricingSnapshot) {
  if (!isPricingSnapshotV2(pricingSnapshot)) return null
  const fb = pricingSnapshot.final_breakdown
  const raw =
    fb.total_guest_payable_rounded_thb ??
    fb.guest_total_thb ??
    pricingSnapshot?.fee_split_v2?.guest_payable_rounded_thb
  const n = Math.round(Number(raw))
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * Attestation mode for a booking row or live pricing result.
 * @param {{ pricingSnapshot?: object, pricingEngineV2Active?: boolean }} ctx
 * @returns {'integer' | 'pot10'}
 */
export function resolveAttestationRoundingMode(ctx = {}) {
  const snap = ctx.pricingSnapshot
  if (isPricingSnapshotV2(snap)) return ROUNDING_MODE_INTEGER
  if (ctx.pricingEngineV2Active === true) return ROUNDING_MODE_INTEGER
  return ROUNDING_MODE_POT10
}

/**
 * Server-side guest total for client attestation (checkout / createBooking).
 * @param {{
 *   guestPayableThb?: number,
 *   pricingSnapshot?: object | null,
 *   pricingEngineV2Active?: boolean,
 *   precomputedRoundedThb?: number | null,
 * }} params
 * @returns {{ totalThb: number, roundingMode: string, source: string, roundingPotThb?: number } | null}
 */
export function computeAttestationGuestTotalThb(params = {}) {
  const snap = params.pricingSnapshot
  const fromV2 = guestRoundedTotalFromSnapshotV2(snap)
  if (fromV2 != null) {
    const fb = snap.final_breakdown || {}
    const pot = Math.round(
      Number(fb.rounding_pot_thb ?? fb.rounding_diff_pot_thb ?? snap?.fee_split_v2?.rounding_pot_thb ?? 0) *
        100,
    ) / 100
    return {
      totalThb: fromV2,
      roundingMode: ROUNDING_MODE_INTEGER,
      source: 'snapshot_v2_final_breakdown',
      roundingPotThb: pot,
    }
  }

  if (params.pricingEngineV2Active && params.precomputedRoundedThb != null) {
    const totalThb = Math.round(Number(params.precomputedRoundedThb))
    if (!Number.isFinite(totalThb) || totalThb < 0) return null
    return {
      totalThb,
      roundingMode: ROUNDING_MODE_INTEGER,
      source: 'pricing_engine_v2',
    }
  }

  const guestPayable = Math.round(Number(params.guestPayableThb))
  if (!Number.isFinite(guestPayable) || guestPayable < 0) return null
  const mode = resolveAttestationRoundingMode(params)
  const rounded = computeRoundedGuestTotal(guestPayable, mode)
  if (!rounded) return null
  return {
    totalThb: rounded.roundedGuestTotalThb,
    roundingMode: mode,
    source: mode === ROUNDING_MODE_INTEGER ? 'legacy_integer' : 'legacy_pot10',
    roundingPotThb: rounded.roundingPotThb,
  }
}

/**
 * Persisted booking → guest payable rounded (checkout display + payment capture).
 * @param {object} booking
 */
export function guestPayableRoundedThbFromBooking(booking) {
  if (!booking) return 0
  const snap =
    booking.pricing_snapshot && typeof booking.pricing_snapshot === 'object'
      ? booking.pricing_snapshot
      : {}
  const fromV2 = guestRoundedTotalFromSnapshotV2(snap)
  if (fromV2 != null) return fromV2

  const fs = snap.fee_split_v2 && typeof snap.fee_split_v2 === 'object' ? snap.fee_split_v2 : {}
  const rounded = Number(fs.guest_payable_rounded_thb)
  if (Number.isFinite(rounded) && rounded > 0) return Math.round(rounded * 100) / 100

  const gross = parseFloat(booking.price_thb ?? booking.priceThb) || 0
  const fee = parseFloat(booking.commission_thb ?? booking.commissionThb) || 0
  const pot = Number(fs.rounding_diff_pot_thb ?? booking.rounding_diff_pot ?? booking.roundingDiffPot ?? 0)
  const taxSnap = snap.tax && typeof snap.tax === 'object' ? snap.tax : {}
  const tax =
    Number.isFinite(Number(fs.tax_amount_thb)) && Number(fs.tax_amount_thb) > 0
      ? Math.round(Number(fs.tax_amount_thb))
      : Math.round(Number(taxSnap.amount_thb) || 0)

  return Math.round((gross + tax + fee + pot) * 100) / 100
}

/**
 * @param {number | string | null | undefined} clientQuotedGuestTotalThb
 * @param {number} serverAttestationThb
 */
export function verifyClientGuestTotalAttestation(clientQuotedGuestTotalThb, serverAttestationThb) {
  if (clientQuotedGuestTotalThb === undefined || clientQuotedGuestTotalThb === null) {
    return { ok: true, skipped: true, serverThb: Math.round(Number(serverAttestationThb)) }
  }
  const clientThb = Math.round(Number(clientQuotedGuestTotalThb))
  const serverThb = Math.round(Number(serverAttestationThb))
  if (!Number.isFinite(clientThb) || !Number.isFinite(serverThb) || clientThb !== serverThb) {
    return { ok: false, clientThb, serverThb }
  }
  return { ok: true, clientThb, serverThb }
}

/**
 * @param {number} subtotalThb
 * @param {number} guestServiceFeePct
 * @returns {number|null}
 */
export function computeGuestPayableTotalThb(subtotalThb, guestServiceFeePct) {
  const s = Math.round(Number(subtotalThb))
  const r = Number(guestServiceFeePct)
  if (!Number.isFinite(s) || !Number.isFinite(r) || r < 0) return null
  const fee = Math.round(s * (r / 100))
  return s + fee
}

/**
 * Stage 127.0/127.1 — SSOT USDT for crypto (implementation in currency.service; dynamic import for client-safe barrel).
 * Do not call from client components — server routes / guards only.
 * @param {object} booking
 * @returns {Promise<number | null>}
 */
export async function getExpectedUsdtForBooking(booking) {
  const { getExpectedUsdtForBooking: resolve } = await import(
    /* webpackIgnore: true */ '@/lib/services/currency.service'
  )
  return resolve(booking)
}

/**
 * Legacy alias — pot10 rounding (ceil to 10 THB).
 * @param {number} guestPayableThb
 */
export function computeRoundedGuestTotalPot(guestPayableThb) {
  const r = computeRoundedGuestTotal(guestPayableThb, ROUNDING_MODE_POT10)
  if (!r) return null
  return {
    roundedGuestTotalThb: r.roundedGuestTotalThb,
    roundingDiffPotThb: r.roundingPotThb,
  }
}
