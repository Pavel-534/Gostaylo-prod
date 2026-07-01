/**
 * Stage 177.3 — metadata facet post-filter guard (unified SQL vs legacy JS).
 */

import { metadataFiltersActive } from '@/lib/search/listing-metadata-filter'

/** @typedef {import('@/lib/search/filter-registry').DiscoveryQueryPlan} DiscoveryQueryPlan */

/**
 * Unified plan already applied transport/yacht JSONB SQL predicates.
 * @param {DiscoveryQueryPlan|null|undefined} plan
 * @returns {boolean}
 */
export function discoveryPlanHasMetadataFacetStep(plan) {
  return (plan?.registryFiltersApplied || []).some(
    (key) => key.startsWith('transport.') || key.startsWith('yacht.'),
  )
}

/**
 * Metadata fields still filtered in JS when service/nanny facets are active (Stage 177.4).
 * @param {ReturnType<import('@/lib/search/listing-metadata-filter').buildMetadataFiltersFromSearchParams>} metadataFilters
 * @returns {ReturnType<import('@/lib/search/listing-metadata-filter').buildMetadataFiltersFromSearchParams>|null}
 */
export function stripRegistryMetadataFieldsForJs(metadataFilters) {
  if (!metadataFilters) return null

  const stripped = {
    ...metadataFilters,
    transmission: null,
    fuelType: null,
    engineCcMin: null,
    cabinsMin: null,
    withCaptain: false,
    vesselType: null,
  }

  return metadataFiltersActive(stripped) ? stripped : null
}

/**
 * JS post-filter payload: skip transport/yacht keys when unified SQL already applied them.
 *
 * @param {ReturnType<import('@/lib/search/listing-metadata-filter').buildMetadataFiltersFromSearchParams>} metadataFilters
 * @param {DiscoveryQueryPlan|null|undefined} plan
 * @param {boolean} unifiedPipeline
 * @returns {ReturnType<import('@/lib/search/listing-metadata-filter').buildMetadataFiltersFromSearchParams>|null}
 */
export function metadataFiltersForJsPostFilter(metadataFilters, plan, unifiedPipeline) {
  if (!metadataFiltersActive(metadataFilters)) return null

  if (unifiedPipeline && discoveryPlanHasMetadataFacetStep(plan)) {
    return stripRegistryMetadataFieldsForJs(metadataFilters)
  }

  return metadataFilters
}
