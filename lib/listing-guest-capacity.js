/**
 * Сколько человек/мест допустимо для объявления (карточка, страница, виджет брони).
 */
import { isTransportListingCategory } from '@/lib/listing-category-slug'

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

  if (isTransportListingCategory(slug)) {
    const seats = positiveInt(meta.seats, 0)
    if (seats > 0) return seats
    return (
      positiveInt(meta.max_guests, 0) ||
      positiveInt(meta.guests, 0) ||
      positiveInt(listing?.maxCapacity, 0) ||
      2
    )
  }

  return (
    positiveInt(meta.max_guests, 0) ||
    positiveInt(meta.guests, 0) ||
    positiveInt(listing?.maxCapacity, 0) ||
    4
  )
}
