/**
 * Stage 199 — Price Truth: one stay-payable formula for search / PDP / checkout tests.
 * Financial fee split SSOT remains `calculateFeeSplitWithPolicy`; display FX = retail (`useFxRatesQuery({ retail: true })`).
 */

import { calculateFeeSplitWithPolicy } from '@/lib/services/pricing/pricing-fee-policy.js'
import { PLATFORM_SPLIT_FEE_DEFAULTS } from '@/lib/config/platform-split-fee-defaults.js'
import { computeRoundedGuestTotal } from '@/lib/booking-price-integrity.js'
import {
  ROUNDING_MODE_POT10,
  getServerGuestRoundingMode,
} from '@/lib/booking-guest-rounding.js'

function normalizeGuestFeePct(pct) {
  const n = Number(pct)
  if (Number.isFinite(n) && n >= 0 && n <= 100) return n
  return PLATFORM_SPLIT_FEE_DEFAULTS.guestServiceFeePercent
}

/**
 * Lodging subtotal (after duration/seasonal, before guest fee / tax / promo).
 * @param {number} lodgingSubtotalThb
 * @param {{
 *   guestServiceFeePercent?: number,
 *   taxRatePercent?: number,
 *   hostCommissionPercent?: number,
 *   promoDiscountThb?: number,
 *   roundingMode?: 'integer' | 'pot10',
 * }} [opts]
 */
export function computeStayGuestPayableTruth(lodgingSubtotalThb, opts = {}) {
  const lodging = Math.max(0, Math.round(Number(lodgingSubtotalThb) || 0))
  const promo = Math.max(0, Math.round(Number(opts.promoDiscountThb) || 0))
  const subtotalThb = Math.max(0, lodging - promo)
  const guestServiceFeePercent = normalizeGuestFeePct(
    opts.guestServiceFeePercent ?? PLATFORM_SPLIT_FEE_DEFAULTS.guestServiceFeePercent,
  )
  const taxRatePercent = Number(opts.taxRatePercent)
  const feeSplit = calculateFeeSplitWithPolicy(subtotalThb, {
    guestServiceFeePercent,
    hostCommissionPercent:
      opts.hostCommissionPercent != null
        ? Number(opts.hostCommissionPercent)
        : PLATFORM_SPLIT_FEE_DEFAULTS.hostCommissionPercentFromGeneral,
    insuranceFundPercent: PLATFORM_SPLIT_FEE_DEFAULTS.insuranceFundPercent,
    taxRatePercent: Number.isFinite(taxRatePercent) && taxRatePercent >= 0 ? taxRatePercent : 0,
  })
  const roundingMode = opts.roundingMode || ROUNDING_MODE_POT10
  const rounded = computeRoundedGuestTotal(feeSplit.guestPayableThb, roundingMode)
  const guestPayableRoundedThb =
    rounded?.roundedGuestTotalThb ?? Math.round(Number(feeSplit.guestPayableThb) || 0)
  const roundingDiffPotThb = rounded?.roundingPotThb ?? 0

  return {
    lodgingSubtotalThb: lodging,
    promoDiscountThb: promo,
    subtotalThb,
    guestServiceFeePercent: feeSplit.guestServiceFeePercent,
    guestServiceFeeThb: feeSplit.guestServiceFeeThb,
    taxRatePercent: feeSplit.taxRatePercent ?? 0,
    taxAmountThb: feeSplit.taxAmountThb ?? 0,
    guestPayableThb: feeSplit.guestPayableThb,
    guestPayableRoundedThb,
    roundingDiffPotThb,
    roundingMode,
    checkoutChargeThb: guestPayableRoundedThb,
    bookingPriceThb: subtotalThb,
    bookingCommissionThb: feeSplit.guestServiceFeeThb,
  }
}

/** Server: same as computeStayGuestPayableTruth with live PricingEngine rounding mode. */
export async function computeStayGuestPayableTruthServer(lodgingSubtotalThb, opts = {}) {
  const roundingMode = opts.roundingMode || (await getServerGuestRoundingMode())
  return computeStayGuestPayableTruth(lodgingSubtotalThb, { ...opts, roundingMode })
}

/**
 * Search card stay total from batch `_pricing` / `pricing` object (already guest-payable when fee fields present).
 * @param {Record<string, unknown> | null | undefined} pricing
 * @param {{ nights?: number, guestServiceFeePercent?: number, basePerNightThb?: number }} [fallback]
 */
export function resolveSearchStayTotalThb(pricing, fallback = {}) {
  const pr = pricing && typeof pricing === 'object' ? pricing : null
  if (pr) {
    const rounded = Number(pr.guestPayableRoundedThb ?? pr.guest_payable_rounded_thb)
    if (Number.isFinite(rounded) && rounded > 0) return Math.round(rounded)

    const feeThb = Number(pr.guestServiceFeeThb ?? pr.guest_service_fee_thb)
    const total = Number(pr.totalPrice ?? pr.total_price)
    if (Number.isFinite(feeThb) && feeThb >= 0 && Number.isFinite(total) && total > 0) {
      return Math.round(total)
    }

    const subtotal = Number(pr.subtotalThb ?? pr.subtotal_thb)
    if (Number.isFinite(subtotal) && subtotal > 0) {
      return computeStayGuestPayableTruth(subtotal, {
        guestServiceFeePercent: pr.guestServiceFeePercent ?? fallback.guestServiceFeePercent,
        taxRatePercent: pr.taxRatePercent ?? 0,
        promoDiscountThb: 0,
      }).guestPayableRoundedThb
    }

    // Legacy lodging-only totalPrice (no fee fields) — apply fee once.
    if (Number.isFinite(total) && total > 0) {
      return computeStayGuestPayableTruth(total, {
        guestServiceFeePercent: fallback.guestServiceFeePercent,
        taxRatePercent: 0,
      }).guestPayableRoundedThb
    }
  }

  const nights = Math.max(1, Math.round(Number(fallback.nights) || 0))
  const base = Math.max(0, Math.round(Number(fallback.basePerNightThb) || 0))
  if (base <= 0) return 0
  return computeStayGuestPayableTruth(base * nights, {
    guestServiceFeePercent: fallback.guestServiceFeePercent,
    taxRatePercent: 0,
  }).guestPayableRoundedThb
}

/**
 * PDP widget final total from priceCalc (display SSOT).
 * @param {Record<string, unknown> | null | undefined} priceCalc
 */
export function resolvePdpWidgetTotalThb(priceCalc) {
  if (!priceCalc || typeof priceCalc !== 'object') return 0
  const final = Math.round(Number(priceCalc.finalTotal) || 0)
  if (final > 0) return final
  const subtotal = Math.round(
    Number(priceCalc.subtotalBeforeFee ?? priceCalc.totalPrice ?? priceCalc.subtotal) || 0,
  )
  const fee = Math.round(Number(priceCalc.serviceFee) || 0)
  const tax = Math.round(Number(priceCalc.taxAmountThb) || 0)
  const pot = Math.round(Number(priceCalc.roundingDiffPot) || 0)
  return Math.max(0, subtotal + fee + tax + pot)
}

/**
 * Checkout charge from booking columns (same as payment intent amount_thb without wallet).
 * @param {{ price_thb?: number, commission_thb?: number, rounding_diff_pot?: number }} booking
 */
export function resolveCheckoutChargeTotalThb(booking) {
  return Math.round(
    (Number(booking?.price_thb || 0) || 0) +
      (Number(booking?.commission_thb || 0) || 0) +
      (Number(booking?.rounding_diff_pot || 0) || 0),
  )
}
