/**
 * Stage 28.0 — детализация цены для гостя / карточки заказа (THB как в ledger).
 * Stage 29.0 — единый breakdown для чекаута (промо / без промо) и карточки заказа.
 */

import { getGuestPayableRoundedThb } from '@/lib/booking-guest-total'

function n(x) {
  const v = Number(x)
  return Number.isFinite(v) ? v : 0
}

/**
 * @typedef {{
 *   listPriceThb: number,
 *   discountThb: number,
 *   serviceTariffThb: number,
 *   platformFeeThb: number,
 *   roundingThb: number,
 *   insuranceThb: number,
 *   totalThb: number,
 *   hasDetail: boolean,
 * }} GuestPriceBreakdown
 */

/**
 * @param {object | null | undefined} booking
 * @returns {GuestPriceBreakdown}
 */
export function buildGuestPriceBreakdownFromBooking(booking) {
  if (!booking) {
    return {
      listPriceThb: 0,
      discountThb: 0,
      serviceTariffThb: 0,
      platformFeeThb: 0,
      roundingThb: 0,
      insuranceThb: 0,
      totalThb: 0,
      hasDetail: false,
    }
  }

  const snap =
    booking.pricing_snapshot && typeof booking.pricing_snapshot === 'object'
      ? booking.pricing_snapshot
      : {}
  const fs = snap.fee_split_v2 && typeof snap.fee_split_v2 === 'object' ? snap.fee_split_v2 : {}

  const serviceTariffThb = n(booking.price_thb ?? booking.priceThb ?? fs.subtotal_thb)
  const platformFeeThb = n(booking.commission_thb ?? booking.commissionThb ?? fs.guest_service_fee_thb)
  const roundingThb = n(booking.rounding_diff_pot ?? booking.roundingDiffPot ?? fs.rounding_diff_pot_thb)
  const insuranceThb = n(fs.insurance_reserve_thb)
  const totalThb = getGuestPayableRoundedThb(booking)

  const hasDetail = serviceTariffThb > 0 || platformFeeThb > 0 || totalThb > 0

  return {
    listPriceThb: 0,
    discountThb: 0,
    serviceTariffThb,
    platformFeeThb,
    roundingThb,
    insuranceThb,
    totalThb,
    hasDetail,
  }
}

/**
 * Pre-payment / checkout: same row semantics as persisted booking after pay.
 * @param {object} p
 * @param {number} p.listPriceThb — list subtotal before promo (optional row when discount &gt; 0)
 * @param {number} [p.discountThb]
 * @param {number} p.serviceTariffThb — tariff after discount (aligns with `price_thb` on booking)
 * @param {number} p.platformFeeThb
 * @param {number} p.roundingThb
 * @param {number} [p.insuranceThb]
 * @param {number} p.totalThb
 * @returns {GuestPriceBreakdown}
 */
export function buildGuestPriceBreakdownFromCheckoutTotals(p) {
  const listPriceThb = n(p?.listPriceThb)
  const discountThb = n(p?.discountThb)
  const serviceTariffThb = n(p?.serviceTariffThb)
  const platformFeeThb = n(p?.platformFeeThb)
  const roundingThb = n(p?.roundingThb)
  const insuranceThb = n(p?.insuranceThb)
  const totalThb = n(p?.totalThb)
  const hasDetail = totalThb > 0 || serviceTariffThb > 0 || platformFeeThb > 0
  return {
    listPriceThb: discountThb > 0 ? listPriceThb : 0,
    discountThb,
    serviceTariffThb,
    platformFeeThb,
    roundingThb,
    insuranceThb,
    totalThb,
    hasDetail,
  }
}
