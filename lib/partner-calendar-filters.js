/**
 * Фильтры мобильного мастер-календаря партнёра (listings.category_id → categories.slug).
 * Канон чипов — `lib/config/category-behavior.js` (Stage 53.0).
 */

import {
  isPartnerCalendarVillasSlug,
  isPartnerCalendarTransportSlug,
  isPartnerCalendarToursSlug,
} from '@/lib/config/category-behavior'

/** @typedef {'all' | 'villas' | 'transport' | 'tours'} PartnerMobileCategoryFilter */

/**
 * @param {{ category?: { slug?: string } | null, categorySlug?: string }} listing
 */
export function getListingCategorySlug(listing) {
  if (!listing) return ''
  const fromJoin = listing.category?.slug
  if (fromJoin) return String(fromJoin).toLowerCase()
  if (listing.categorySlug) return String(listing.categorySlug).toLowerCase()
  return ''
}

/**
 * @param {PartnerMobileCategoryFilter} filter
 * @param {{ category?: { slug?: string } | null, categorySlug?: string }} listingRow — item.listing из API календаря
 */
export function listingMatchesPartnerMobileCategoryFilter(listingRow, filter) {
  if (filter === 'all') return true
  const slug = getListingCategorySlug(listingRow)
  if (!slug) return filter === 'all'
  if (filter === 'villas') return isPartnerCalendarVillasSlug(slug)
  if (filter === 'transport') return isPartnerCalendarTransportSlug(slug)
  if (filter === 'tours') return isPartnerCalendarToursSlug(slug)
  return true
}

/**
 * Иконка строки сетки: легаси-ключ type (villa, yacht, bike, car).
 * @param {string} [categorySlug]
 */
export function mapCategorySlugToListingType(categorySlug) {
  if (!categorySlug) return undefined
  const s = String(categorySlug).toLowerCase()
  if (s === 'vehicles') return 'car'
  if (s === 'yachts') return 'yacht'
  if (s === 'property') return 'villa'
  if (s === 'tours') return 'villa'
  return undefined
}
