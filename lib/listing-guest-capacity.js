/**
 * Сколько человек/мест допустимо для объявления (карточка, страница, виджет брони).
 */
import {
  isTransportListingCategory,
  showsPropertyInteriorSpecs,
} from '@/lib/listing-category-slug'

function positiveInt(v, fallback) {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? '').replace(/\D/g, ''), 10)
  if (Number.isFinite(n) && n > 0) return n
  return fallback
}

/**
 * @param {object} listing
 * @returns {number}
 */
export function resolveListingGuestCapacity(listing) {
  const meta = listing?.metadata || {}
  const slug = String(
    listing?.categorySlug || listing?.category?.slug || listing?.categories?.slug || '',
  ).toLowerCase()

  const listingCap = positiveInt(listing?.maxCapacity, 0)
  const metaGuests = positiveInt(meta.max_guests, 0) || positiveInt(meta.guests, 0)
  const bedrooms = positiveInt(meta.bedrooms, 0)

  if (isTransportListingCategory(slug)) {
    const seats = positiveInt(meta.seats, 0)
    if (seats > 0) return seats
    const fallback = metaGuests || listingCap || 2
    return fallback > 0 ? fallback : 2
  }

  /** Prefer API max_capacity when metadata still has a stale low value (e.g. 1). */
  let combined = Math.max(listingCap, metaGuests)
  if (showsPropertyInteriorSpecs(slug) && bedrooms > 0) {
    const fromBeds = Math.max(bedrooms * 2, bedrooms + 1)
    if (combined <= 1 || combined < fromBeds) combined = Math.max(combined, fromBeds)
  }
  if (combined > 0) return combined
  return 4
}
