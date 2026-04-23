function normalizeCategorySlug(input) {
  return String(input || '').trim().toLowerCase()
}

function resolveOrderType(booking) {
  const listing = booking?.listings || {}
  const listingMeta = listing?.metadata && typeof listing.metadata === 'object' ? listing.metadata : {}
  const bookingMeta = booking?.metadata && typeof booking.metadata === 'object' ? booking.metadata : {}

  const slugCandidates = [
    listing?.category_slug,
    listing?.category?.slug,
    listingMeta?.category_slug,
    listingMeta?.categorySlug,
    bookingMeta?.listing_category_slug,
    bookingMeta?.listingCategorySlug,
  ].map(normalizeCategorySlug)

  const joined = slugCandidates.filter(Boolean).join(' ')
  const isTransport =
    joined.includes('vehicle') ||
    joined.includes('transport') ||
    joined.includes('car') ||
    joined.includes('bike') ||
    joined.includes('moto') ||
    joined.includes('yacht') ||
    joined.includes('boat')

  return isTransport ? 'transport' : 'home'
}

function toIsoOrNull(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function toUnifiedOrder(booking) {
  const currency = String(booking?.currency || 'THB').toUpperCase()
  const pricePaid = Number(booking?.price_paid)
  const priceThb = Number(booking?.price_thb)
  const totalPrice = currency === 'THB' || !Number.isFinite(pricePaid) ? priceThb : pricePaid

  const metadata = booking?.metadata && typeof booking.metadata === 'object' ? booking.metadata : {}

  return {
    id: String(booking?.id || ''),
    type: resolveOrderType(booking),
    status: String(booking?.status || ''),
    total_price: Number.isFinite(totalPrice) ? totalPrice : 0,
    currency,
    dates: {
      check_in: toIsoOrNull(booking?.check_in),
      check_out: toIsoOrNull(booking?.check_out),
      created_at: toIsoOrNull(booking?.created_at),
      updated_at: toIsoOrNull(booking?.updated_at),
    },
    metadata,
  }
}
