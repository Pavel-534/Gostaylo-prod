/**
 * Stage 177.3–177.4 — metadata facet post-filter guard (unified SQL vs legacy JS).
 */

import { metadataFiltersActive } from '@/lib/search/listing-metadata-filter'

/** @typedef {import('@/lib/search/filter-registry').DiscoveryQueryPlan} DiscoveryQueryPlan */

/**
 * Unified plan already applied transport/yacht/service JSONB SQL predicates.
 * @param {DiscoveryQueryPlan|null|undefined} plan
 * @returns {boolean}
 */
export function discoveryPlanHasMetadataFacetStep(plan) {
  return (plan?.registryFiltersApplied || []).some(
    (key) =>
      key.startsWith('transport.') ||
      key.startsWith('yacht.') ||
      key.startsWith('service.'),
  )
}

/**
 * Service/nanny metadata facets active in legacy JS filter object.
 * @param {ReturnType<import('@/lib/search/listing-metadata-filter').buildMetadataFiltersFromSearchParams>} metadataFilters
 * @returns {boolean}
 */
export function hadServiceMetadataActive(metadataFilters) {
  if (!metadataFilters) return false
  return !!(
    (metadataFilters.nannyLangs && metadataFilters.nannyLangs.length) ||
    (Number.isFinite(metadataFilters.nannyExperienceMin) &&
      metadataFilters.nannyExperienceMin >= 1) ||
    metadataFilters.nannySpecialization ||
    metadataFilters.serviceHomeVisitOnly === true
  )
}

/**
 * Strip service/nanny fields handled by unified registry SQL (Stage 177.4).
 * @param {ReturnType<import('@/lib/search/listing-metadata-filter').buildMetadataFiltersFromSearchParams>} metadataFilters
 * @returns {ReturnType<import('@/lib/search/listing-metadata-filter').buildMetadataFiltersFromSearchParams>|null}
 */
export function stripServiceMetadataFieldsForJs(metadataFilters) {
  if (!metadataFilters) return null

  const stripped = {
    ...metadataFilters,
    nannyLangs: [],
    nannyExperienceMin: null,
    nannySpecialization: null,
    serviceHomeVisitOnly: false,
  }

  return metadataFiltersActive(stripped) ? stripped : null
}

/**
 * Strip registry SQL facets (transport / yacht / service) from JS post-filter payload.
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
    nannyLangs: [],
    nannyExperienceMin: null,
    nannySpecialization: null,
    serviceHomeVisitOnly: false,
  }

  return metadataFiltersActive(stripped) ? stripped : null
}

/**
 * JS post-filter payload: skip registry metadata keys when unified SQL already applied them.
 *
 * @param {ReturnType<import('@/lib/search/listing-metadata-filter').buildMetadataFiltersFromSearchParams>} metadataFilters
 * @param {DiscoveryQueryPlan|null|undefined} plan
 * @param {boolean} unifiedPipeline
 * @returns {ReturnType<import('@/lib/search/listing-metadata-filter').buildMetadataFiltersFromSearchParams>|null}
 */
export function metadataFiltersForJsPostFilter(metadataFilters, plan, unifiedPipeline) {
  if (!metadataFiltersActive(metadataFilters)) return null

  if (unifiedPipeline) {
    return stripRegistryMetadataFieldsForJs(metadataFilters)
  }

  return metadataFilters
}
