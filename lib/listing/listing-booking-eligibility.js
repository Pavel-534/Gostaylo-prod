/**
 * Stage 149.2 — guest booking eligibility (listing visibility + host payout).
 */

import { assertHostPayoutReadyForBooking } from '@/lib/partner/host-payout-booking-gate'

/**
 * @param {object | null | undefined} listing — row with status, available, owner_id
 * @returns {Promise<{ ok: true } | { ok: false, code: string, error: string }>}
 */
export async function assertListingBookableForGuest(listing) {
  const status = String(listing?.status || '').toUpperCase()
  if (status !== 'ACTIVE' || listing?.available === false) {
    return {
      ok: false,
      code: 'LISTING_NOT_BOOKABLE',
      error: 'This listing is not available for booking.',
    }
  }

  return assertHostPayoutReadyForBooking(listing.owner_id)
}
