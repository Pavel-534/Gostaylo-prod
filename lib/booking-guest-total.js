/**
 * Guest-facing totals (Fee Split v3.5.0) — align with ledger `computeBookingPaymentLedgerLegs`.
 * User total (THB) = price_thb (subtotal) + commission_thb (guest service fee) + rounding pot.
 */

function round2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

/**
 * @param {object} booking — row from API (snake_case) or camelCase from partner transform
 * @returns {number}
 */
export function getGuestPayableRoundedThb(booking) {
  if (!booking) return 0;
  const snap =
    booking.pricing_snapshot && typeof booking.pricing_snapshot === 'object'
      ? booking.pricing_snapshot
      : {};
  const fs =
    snap.fee_split_v2 && typeof snap.fee_split_v2 === 'object' ? snap.fee_split_v2 : {};

  const rounded = Number(fs.guest_payable_rounded_thb);
  if (Number.isFinite(rounded) && rounded > 0) return round2(rounded);

  const gross = parseFloat(booking.price_thb ?? booking.priceThb) || 0;
  const fee = parseFloat(booking.commission_thb ?? booking.commissionThb) || 0;
  const pot = round2(fs.rounding_diff_pot_thb ?? booking.rounding_diff_pot ?? booking.roundingDiffPot ?? 0);

  return round2(gross + fee + pot);
}
