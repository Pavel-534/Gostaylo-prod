/**
 * Определение «жильё / размещение» для партнёрского визарда (без цикла с category-form-schema).
 */
import { isTransportListingCategory } from '@/lib/listing-category-slug'

/** Slugs, для которых в normalize применяется блок «жильё» (числа комнат и т.д.). */
export const PARTNER_LISTING_HOUSING_SLUGS = new Set([
  'property',
  'villa',
  'apartment',
  'house',
  'condo',
  'studio',
  'penthouse',
  'accommodation',
])

export function isPartnerListingHousingCategory(categorySlug, categoryName = '') {
  const s = String(categorySlug || '').toLowerCase()
  const n = String(categoryName || '').toLowerCase()
  if (PARTNER_LISTING_HOUSING_SLUGS.has(s)) return true
  if (s === 'tours' || s === 'yachts' || isTransportListingCategory(s) || s === 'nanny' || s === 'babysitter') {
    return false
  }
  if (s === 'property') return true
  if (
    n.includes('villa') ||
    n.includes('property') ||
    n.includes('недвижим') ||
    n.includes('апарт') ||
    n.includes('вилл') ||
    n.includes('жиль')
  ) {
    return true
  }
  return false
}
