/**
 * Partner unified order shape for list/drawer (Stage 185.0 / 186.2b / 200).
 * Delegates type resolution to toUnifiedOrder SSOT.
 */

import { toUnifiedOrder } from '@/lib/models/unified-order.js'

function toIsoOrNull(value) {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Partner list unified order shape (until API returns toUnifiedOrder). */
export function buildPartnerUnifiedOrder(booking) {
  const listing = booking?.listing || booking?.listings || {}
  const bridged = {
    id: booking?.id,
    status: booking?.status,
    currency: 'THB',
    price_thb: booking?.guestPayableThb ?? booking?.priceThb ?? booking?.price_thb,
    price_paid: booking?.guestPayableThb ?? booking?.priceThb ?? booking?.price_thb,
    check_in: booking?.checkIn || booking?.check_in,
    check_out: booking?.checkOut || booking?.check_out,
    created_at: booking?.createdAt || booking?.created_at,
    updated_at: booking?.updatedAt || booking?.updated_at,
    metadata: booking?.metadata && typeof booking.metadata === 'object' ? booking.metadata : {},
    listings: {
      ...listing,
      category_slug:
        listing?.category_slug ||
        listing?.category?.slug ||
        listing?.metadata?.category_slug ||
        booking?.metadata?.listing_category_slug,
      wizard_profile:
        listing?.wizard_profile ||
        listing?.category?.wizard_profile ||
        listing?.metadata?.wizard_profile ||
        null,
    },
  }
  const unified = toUnifiedOrder(bridged)
  return {
    ...unified,
    dates: {
      check_in: unified.dates.check_in || toIsoOrNull(bridged.check_in),
      check_out: unified.dates.check_out || toIsoOrNull(bridged.check_out),
      created_at: unified.dates.created_at || toIsoOrNull(bridged.created_at),
      updated_at: unified.dates.updated_at || toIsoOrNull(bridged.updated_at),
    },
  }
}
