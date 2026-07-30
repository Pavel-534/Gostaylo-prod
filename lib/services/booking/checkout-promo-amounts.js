/**
 * Stage 197.1 — Pure helpers: checkout promo base subtotal & expected intent amount (no Next/DB).
 */

function readSnap(booking) {
  const s = booking?.pricing_snapshot
  return s && typeof s === 'object' ? s : {}
}

/**
 * Subtotal after duration discount, before promo (THB).
 * @param {object} booking
 */
export function resolveCheckoutPromoBaseSubtotalThb(booking) {
  const snap = readSnap(booking)
  const fromSnap = Math.round(Number(snap.accommodation_total_after_duration_thb))
  if (Number.isFinite(fromSnap) && fromSnap > 0) return fromSnap

  const priceThb = Math.round(Number(booking?.price_thb ?? booking?.priceThb) || 0)
  const promoExtra = Math.round(
    Number(snap?.promo?.extra_discount_thb ?? snap?.promoExtraDiscountThb ?? 0) || 0,
  )
  return Math.max(0, priceThb + Math.max(0, promoExtra))
}

/**
 * Expected payment intent amount_thb from booking row (wallet discount already on commission if applied).
 * @param {object} booking
 */
export function expectedPaymentIntentAmountThbFromBooking(booking) {
  return Math.round(
    (Number(booking?.price_thb || 0) || 0) +
      (Number(booking?.commission_thb || 0) || 0) +
      (Number(booking?.rounding_diff_pot || 0) || 0),
  )
}
