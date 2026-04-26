/**
 * Guest-facing totals (Fee Split v3.5.0 + Stage 56.0 VAT) — align with ledger `computeBookingPaymentLedgerLegs`.
 * Canonical total: `fee_split_v2.guest_payable_rounded_thb` when present.
 * Fallback: subtotal + VAT (from snapshot) + guest service fee + rounding pot.
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
  const taxSnap = snap.tax && typeof snap.tax === 'object' ? snap.tax : {};
  const tax =
    Number.isFinite(Number(fs.tax_amount_thb)) && Number(fs.tax_amount_thb) > 0
      ? Math.round(Number(fs.tax_amount_thb))
      : Math.round(Number(taxSnap.amount_thb) || 0);

  return round2(gross + tax + fee + pot);
}
