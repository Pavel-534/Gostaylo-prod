/**
 * Guest payable rounding — integer THB (Stage 97.0.3).
 * Remainder flows to platform revenue as `rounding_pot_thb` (not absorbed silently).
 */

/**
 * @param {number} guestPayableThb — subtotal + tax + guest service fee (may be fractional)
 * @returns {{ total_guest_payable_thb: number, total_guest_payable_rounded_thb: number, rounding_pot_thb: number }}
 */
export function roundGuestPayableToIntegerThb(guestPayableThb) {
  const raw = Number(guestPayableThb)
  const base = Number.isFinite(raw) ? raw : 0
  const rounded = Math.round(base)
  const pot = Math.round((rounded - base) * 100) / 100
  return {
    total_guest_payable_thb: Math.round(base * 100) / 100,
    total_guest_payable_rounded_thb: rounded,
    rounding_pot_thb: pot,
  }
}
