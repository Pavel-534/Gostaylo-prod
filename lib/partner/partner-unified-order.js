/**
 * Partner unified order shape for list/drawer (Stage 185.0 / 186.2b).
 * No i18n imports — safe for unit tests.
 */

function toIsoOrNull(value) {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function inferTypeFromSlug(slug) {
  const s = String(slug || '').toLowerCase()
  if (s.includes('vehicle') || s.includes('transport') || s.includes('bike') || s.includes('car')) {
    return 'transport'
  }
  if (s.includes('tour') || s.includes('activity')) return 'activity'
  return 'home'
}

/** Partner list unified order shape (until API returns toUnifiedOrder). */
export function buildPartnerUnifiedOrder(booking) {
  const listing = booking?.listing || booking?.listings || {}
  const categorySlug =
    listing?.category_slug ||
    listing?.category?.slug ||
    listing?.metadata?.category_slug ||
    booking?.metadata?.listing_category_slug
  return {
    id: String(booking?.id || ''),
    type: inferTypeFromSlug(categorySlug),
    status: String(booking?.status || '').toUpperCase(),
    total_price: Number(booking?.guestPayableThb ?? booking?.priceThb),
    currency: 'THB',
    dates: {
      check_in: toIsoOrNull(booking?.checkIn || booking?.check_in),
      check_out: toIsoOrNull(booking?.checkOut || booking?.check_out),
      created_at: toIsoOrNull(booking?.createdAt || booking?.created_at),
      updated_at: toIsoOrNull(booking?.updatedAt || booking?.updated_at),
    },
    metadata: booking?.metadata && typeof booking.metadata === 'object' ? booking.metadata : {},
  }
}
