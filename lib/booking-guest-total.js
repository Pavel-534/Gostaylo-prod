/**
 * Guest-facing totals — delegates to attestation SSOT (Stage 100).
 * @see lib/booking-price-integrity.js
 */

import { guestPayableRoundedThbFromBooking } from '@/lib/booking-price-integrity'

/**
 * @param {object} booking — row from API (snake_case) or camelCase from partner transform
 * @returns {number}
 */
export function getGuestPayableRoundedThb(booking) {
  return guestPayableRoundedThbFromBooking(booking)
}
