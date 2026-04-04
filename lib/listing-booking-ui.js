/**
 * Listing booking UX: category-driven exclusive vs shared-inventory UI.
 * DB slugs: property, vehicles, tours, yachts (+ optional services / nanny).
 */

import { normalizeListingCategorySlugForSearch } from '@/lib/listing-category-slug'

/** Villas / apartments / homes — single-unit calendar semantics in UI */
export function isExclusiveInventoryCategory(categorySlug) {
  const n = normalizeListingCategorySlugForSearch(categorySlug)
  return n === 'property' || n === 'vehicles'
}

/** Tours, yachts, services — show spots + private / special quote */
export function isSharedInventoryCategory(categorySlug) {
  const s = String(categorySlug || '').toLowerCase()
  if (['tours', 'yachts', 'services', 'nanny', 'service'].includes(s)) return true
  if (s.includes('tour') || s.includes('yacht') || s.includes('boat')) return true
  return false
}

/**
 * @param {string | null | undefined} categorySlug
 * @param {number} [maxCapacity]
 * @returns {'exclusive' | 'shared'}
 */
export function getListingBookingUiMode(categorySlug, maxCapacity = 1) {
  if (isSharedInventoryCategory(categorySlug)) return 'shared'
  if (isExclusiveInventoryCategory(categorySlug)) return 'exclusive'
  const cap = Math.max(1, parseInt(maxCapacity, 10) || 1)
  return cap > 1 ? 'shared' : 'exclusive'
}
