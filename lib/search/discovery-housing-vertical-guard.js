/**
 * Stage 177.2b — housing-scoped registry filters vs category vertical.
 */

import { isHousingCategory } from '@/lib/config/category-behavior'

/** Registry keys ignored when category is not housing (transport, service, …). */
export const HOUSING_SCOPED_REGISTRY_FILTER_KEYS = new Set([
  'housing.bedrooms',
  'housing.bathrooms',
  'housing.property_type',
  'housing.amenities',
  'stay.guests',
])

/**
 * @param {string} key
 * @returns {boolean}
 */
export function isHousingScopedRegistryFilterKey(key) {
  return HOUSING_SCOPED_REGISTRY_FILTER_KEYS.has(key)
}

/**
 * Housing facets apply when category is unset (all) or housing vertical.
 * @param {import('@/lib/search/filter-registry').DiscoveryFilterContract} contract
 * @returns {boolean}
 */
export function isHousingFilterVerticalAllowed(contract) {
  const slug = contract?.categorySlug
  if (!slug) return true
  if (isHousingCategory(slug)) return true

  const normalized = String(slug).toLowerCase().trim()
  return normalized === 'stays' || normalized === 'property' || normalized === 'housing'
}
