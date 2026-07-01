/**
 * Stage 177.4 — service & nanny registry filter vertical guards.
 */

/** Registry keys scoped to service marketplace parent categories only. */
export const SERVICE_SCOPED_REGISTRY_FILTER_KEYS = new Set([
  'service.languages',
  'service.experience_min',
  'service.specialization',
  'service.home_visit',
])

/**
 * Parent category slugs where service facets may apply (never category=all).
 * @type {ReadonlySet<string>}
 */
export const SERVICE_FILTER_ALLOWED_CATEGORY_SLUGS = new Set(['services', 'nannies'])

/**
 * @param {string} key
 * @returns {boolean}
 */
export function isServiceScopedRegistryFilterKey(key) {
  return SERVICE_SCOPED_REGISTRY_FILTER_KEYS.has(key)
}

/**
 * Service facets apply only on explicit marketplace parent categories.
 * @param {import('@/lib/search/filter-registry').DiscoveryFilterContract} contract
 * @returns {boolean}
 */
export function isServiceFilterVerticalAllowed(contract) {
  const slug = String(contract?.categorySlug || '')
    .toLowerCase()
    .trim()
  if (!slug) return false
  return SERVICE_FILTER_ALLOWED_CATEGORY_SLUGS.has(slug)
}

/**
 * @param {import('@/lib/search/filter-registry').DiscoveryFilterContract} contract
 * @param {string} key
 * @returns {boolean}
 */
export function isServiceRegistryFilterAllowedForContract(contract, key) {
  if (!isServiceScopedRegistryFilterKey(key)) {
    return true
  }
  return isServiceFilterVerticalAllowed(contract)
}
