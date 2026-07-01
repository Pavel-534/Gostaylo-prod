/**
 * Stage 177.3 — transport & yacht registry filter vertical guards.
 */

import {
  isTransportListingCategory,
  isYachtLikeCategory,
} from '@/lib/listing-category-slug'

/** Registry keys scoped to land/air transport categories (not category=all). */
export const TRANSPORT_SCOPED_REGISTRY_FILTER_KEYS = new Set([
  'transport.transmission',
  'transport.fuel_type',
  'transport.engine_cc_min',
])

/** Registry keys scoped to yacht-like categories (+ helicopter for with_captain). */
export const YACHT_SCOPED_REGISTRY_FILTER_KEYS = new Set([
  'yacht.with_captain',
  'yacht.vessel_type',
  'yacht.cabins_min',
])

/**
 * @param {string} key
 * @returns {boolean}
 */
export function isTransportScopedRegistryFilterKey(key) {
  return TRANSPORT_SCOPED_REGISTRY_FILTER_KEYS.has(key)
}

/**
 * @param {string} key
 * @returns {boolean}
 */
export function isYachtScopedRegistryFilterKey(key) {
  return YACHT_SCOPED_REGISTRY_FILTER_KEYS.has(key)
}

/**
 * @param {string | null | undefined} slug
 * @returns {boolean}
 */
export function isHelicopterListingCategory(slug) {
  const s = String(slug || '').toLowerCase().trim()
  return s === 'helicopter' || s === 'helicopters'
}

/**
 * Transport facets apply only on an explicit transport category (never category=all).
 * @param {import('@/lib/search/filter-registry').DiscoveryFilterContract} contract
 * @returns {boolean}
 */
export function isTransportFilterVerticalAllowed(contract) {
  const slug = contract?.categorySlug
  if (!slug) return false
  return isTransportListingCategory(slug)
}

/**
 * @param {import('@/lib/search/filter-registry').DiscoveryFilterContract} contract
 * @param {string} key
 * @returns {boolean}
 */
export function isYachtFilterVerticalAllowed(contract, key) {
  const slug = contract?.categorySlug
  if (!slug) return false

  if (key === 'yacht.with_captain') {
    return isYachtLikeCategory(slug) || isHelicopterListingCategory(slug)
  }

  return isYachtLikeCategory(slug)
}

/**
 * @param {import('@/lib/search/filter-registry').DiscoveryFilterContract} contract
 * @param {string} key
 * @returns {boolean}
 */
export function isTransportOrYachtRegistryFilterAllowedForContract(contract, key) {
  if (TRANSPORT_SCOPED_REGISTRY_FILTER_KEYS.has(key)) {
    return isTransportFilterVerticalAllowed(contract)
  }
  if (YACHT_SCOPED_REGISTRY_FILTER_KEYS.has(key)) {
    return isYachtFilterVerticalAllowed(contract, key)
  }
  return true
}
