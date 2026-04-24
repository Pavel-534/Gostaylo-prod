/**
 * Stage 28.0 — детализация цены для гостя / карточки заказа (THB как в ledger).
 * Stage 29.0 — единый breakdown для чекаута (промо / без промо) и карточки заказа.
 * Stage 30.0 — промокод в SSOT-breakdown, раздельные строки duration / promo из pricing_snapshot.
 */

import { getGuestPayableRoundedThb } from '@/lib/booking-guest-total'

function n(x) {
  const v = Number(x)
  return Number.isFinite(v) ? v : 0
}

/**
 * @typedef {{
 *   catalogSubtotalThb: number,
 *   listPriceThb: number,
 *   durationDiscountThb: number,
 *   durationCaptionRu: string | null,
 *   durationCaptionEn: string | null,
 *   promoDiscountThb: number,
 *   promoCode: string | null,
 *   discountThb: number,
 *   serviceTariffThb: number,
 *   platformFeeThb: number,
 *   roundingThb: number,
 *   insuranceThb: number,
 *   totalThb: number,
 *   hasDetail: boolean,
 * }} GuestPriceBreakdown
 */

function readSnap(booking) {
  return booking?.pricing_snapshot && typeof booking.pricing_snapshot === 'object'
    ? booking.pricing_snapshot
    : {}
}

/**
 * @param {object | null | undefined} booking
 * @returns {GuestPriceBreakdown}
 */
export function buildGuestPriceBreakdownFromBooking(booking) {
  if (!booking) {
    return emptyBreakdown()
  }

  const snap = readSnap(booking)
  const fs = snap.fee_split_v2 && typeof snap.fee_split_v2 === 'object' ? snap.fee_split_v2 : {}

  const serviceTariffThb = n(booking.price_thb ?? booking.priceThb ?? fs.subtotal_thb)
  const platformFeeThb = n(booking.commission_thb ?? booking.commissionThb ?? fs.guest_service_fee_thb)
  const roundingThb = n(booking.rounding_diff_pot ?? booking.roundingDiffPot ?? fs.rounding_diff_pot_thb)
  const insuranceThb = n(fs.insurance_reserve_thb)
  const totalThb = getGuestPayableRoundedThb(booking)

  const durObj = snap.duration_discount && typeof snap.duration_discount === 'object' ? snap.duration_discount : null
  const durationDiscountThb = n(durObj?.amount_thb)

  const promoSnap = snap.promo && typeof snap.promo === 'object' ? snap.promo : null
  let promoDiscountThb = n(promoSnap?.extra_discount_thb)
  const promoCodeRaw =
    (typeof promoSnap?.code === 'string' && promoSnap.code.trim()) ||
    (typeof booking.promo_code_used === 'string' && booking.promo_code_used.trim()) ||
    (typeof booking.promoCodeUsed === 'string' && booking.promoCodeUsed.trim()) ||
    null

  const discountTotal = n(booking.discount_amount ?? booking.discountAmount)
  if (promoDiscountThb <= 0 && promoCodeRaw && discountTotal > durationDiscountThb) {
    promoDiscountThb = Math.max(0, discountTotal - durationDiscountThb)
  }

  const catalogSubtotalThb = n(snap.subtotal_before_duration_discount_thb)
  const recomposedList = serviceTariffThb + promoDiscountThb + durationDiscountThb
  const listPriceThb =
    catalogSubtotalThb > 0
      ? catalogSubtotalThb
      : discountTotal > 0 && recomposedList > 0
        ? recomposedList
        : 0

  const durationCaptionRu = typeof durObj?.caption_ru === 'string' ? durObj.caption_ru.trim() : null
  const durationCaptionEn = typeof durObj?.caption_en === 'string' ? durObj.caption_en.trim() : null

  const discountThb = durationDiscountThb + promoDiscountThb
  const hasDetail = serviceTariffThb > 0 || platformFeeThb > 0 || totalThb > 0 || discountThb > 0

  return {
    catalogSubtotalThb,
    listPriceThb,
    durationDiscountThb,
    durationCaptionRu,
    durationCaptionEn,
    promoDiscountThb,
    promoCode: promoCodeRaw,
    discountThb,
    serviceTariffThb,
    platformFeeThb,
    roundingThb,
    insuranceThb,
    totalThb,
    hasDetail,
  }
}

function emptyBreakdown() {
  return {
    catalogSubtotalThb: 0,
    listPriceThb: 0,
    durationDiscountThb: 0,
    durationCaptionRu: null,
    durationCaptionEn: null,
    promoDiscountThb: 0,
    promoCode: null,
    discountThb: 0,
    serviceTariffThb: 0,
    platformFeeThb: 0,
    roundingThb: 0,
    insuranceThb: 0,
    totalThb: 0,
    hasDetail: false,
  }
}

/**
 * Pre-payment / checkout: same row semantics as persisted booking after pay.
 * @param {object} p
 * @param {number} p.listPriceThb
 * @param {number} [p.discountThb]
 * @param {string | null} [p.promoCode]
 * @param {number} p.serviceTariffThb
 * @param {number} p.platformFeeThb
 * @param {number} p.roundingThb
 * @param {number} [p.insuranceThb]
 * @param {number} p.totalThb
 * @returns {GuestPriceBreakdown}
 */
export function buildGuestPriceBreakdownFromCheckoutTotals(p) {
  const listPriceThb = n(p?.listPriceThb)
  const discountThb = n(p?.discountThb)
  const promoCode =
    typeof p?.promoCode === 'string' && p.promoCode.trim() ? p.promoCode.trim().toUpperCase() : null
  const serviceTariffThb = n(p?.serviceTariffThb)
  const platformFeeThb = n(p?.platformFeeThb)
  const roundingThb = n(p?.roundingThb)
  const insuranceThb = n(p?.insuranceThb)
  const totalThb = n(p?.totalThb)
  const hasDetail = totalThb > 0 || serviceTariffThb > 0 || platformFeeThb > 0 || discountThb > 0
  return {
    catalogSubtotalThb: discountThb > 0 ? listPriceThb : 0,
    listPriceThb: discountThb > 0 ? listPriceThb : 0,
    durationDiscountThb: 0,
    durationCaptionRu: null,
    durationCaptionEn: null,
    promoDiscountThb: discountThb,
    promoCode,
    discountThb,
    serviceTariffThb,
    platformFeeThb,
    roundingThb,
    insuranceThb,
    totalThb,
    hasDetail,
  }
}
