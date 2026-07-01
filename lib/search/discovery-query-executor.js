/**
 * Stage 177.1–177.2b — execute unified discovery SQL plan (category → bbox → housing facets → cursor).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { buildListingsQuery } from '@/lib/api/search/query-builder'
import { buildMapPinsQuery } from '@/lib/api/search/map-pins-query'
import { resolveSpatialListingIdsFromPlan } from '@/lib/api/search/discovery-spatial-rpc'
import { applyDiscoveryCursorToQuery } from '@/lib/api/search/discovery-cursor-sql'
import {
  applyDiscoveryScalarFiltersFromPlan,
  legacyFiltersForUnifiedDiscoveryPlan,
} from '@/lib/api/search/discovery-scalar-sql'
import { slicePageAndBuildNextCursor } from '@/lib/search/discovery-cursor-page'

export { slicePageAndBuildNextCursor } from '@/lib/search/discovery-cursor-page'

/** @typedef {import('@/lib/search/filter-registry').DiscoveryQueryPlan} DiscoveryQueryPlan */

/**
 * Cascade: category (SQL) → bbox GiST ids → plan scalar/jsonb facets → cursor keyset.
 *
 * @param {DiscoveryQueryPlan} plan
 * @param {{
 *   legacyFilters: object,
 *   fetchLimit?: number,
 *   textOrClause: string|null,
 *   includeTextSearchOr?: boolean,
 *   listingsSelect: string,
 * }} options
 * @returns {Promise<{
 *   data: object[]|null,
 *   error: object|null,
 *   plan: DiscoveryQueryPlan,
 *   nextCursor?: string|null,
 *   pagination?: { mode: 'cursor', pageSize: number, next_cursor: string|null, hasMore: boolean },
 * }>}
 */
export async function executeDiscoverySqlPlan(plan, options) {
  const spatialIds = await resolveSpatialListingIdsFromPlan(plan)

  const categoryIds = plan.sql.categoryIds
  const bboxLegacy = plan.spatial.bboxLegacy
  const queryFilters = legacyFiltersForUnifiedDiscoveryPlan(options.legacyFilters, plan)

  const usesCursorPagination = plan.sql?.paginationMode === 'cursor'
  const fetchLimit = options.fetchLimit ?? plan.sql.fetchLimit

  let q = await buildListingsQuery({
    supabaseAdmin,
    filters: queryFilters,
    fetchLimit,
    textOrClause: options.textOrClause,
    categoryIds,
    bbox: spatialIds ? null : bboxLegacy,
    centerBbox: null,
    spatialListingIds: spatialIds ?? null,
    includeTextSearchOr: options.includeTextSearchOr !== false,
    listingsSelect: options.listingsSelect,
    discoveryPlan: plan,
    deferOrderAndLimit: usesCursorPagination,
  })

  q = applyDiscoveryScalarFiltersFromPlan(q, plan)

  if (usesCursorPagination) {
    q = applyDiscoveryCursorToQuery(
      q,
      plan.sql.cursor,
      plan.sql.orderBy,
      plan.sql.pageSize,
      plan.sql.overFetch ?? 1,
    )
  }

  const { data, error } = await q

  if (!usesCursorPagination) {
    return { data, error, plan }
  }

  const { pageRows, nextCursor, hasMore } = slicePageAndBuildNextCursor(data, plan.sql.pageSize)
  const pageSize = plan.sql.pageSize ?? pageRows.length

  return {
    data: pageRows,
    error,
    plan,
    nextCursor,
    pagination: {
      mode: 'cursor',
      pageSize,
      next_cursor: nextCursor,
      hasMore,
    },
  }
}

/**
 * @param {DiscoveryQueryPlan} plan
 * @returns {Promise<{ listingIds: string[]|null, plan: DiscoveryQueryPlan }>}
 */
export async function executeDiscoverySpatialPrefilter(plan) {
  const ids = await resolveSpatialListingIdsFromPlan(plan)
  return { listingIds: ids, plan }
}

/**
 * Map pins SQL slice — same cascade as catalog (category → bbox ids → housing facets).
 *
 * @param {DiscoveryQueryPlan} plan
 * @param {{
 *   legacyFilters: object,
 *   fetchLimit: number,
 *   textOrClause: string|null,
 *   includeTextSearchOr?: boolean,
 * }} options
 */
export async function executeMapPinsDiscoverySqlPlan(plan, options) {
  const spatialIds = await resolveSpatialListingIdsFromPlan(plan)
  const categoryIds = plan.sql.categoryIds
  const bboxLegacy = plan.spatial.bboxLegacy
  const queryFilters = legacyFiltersForUnifiedDiscoveryPlan(options.legacyFilters, plan)

  let q = await buildMapPinsQuery({
    supabaseAdmin,
    filters: queryFilters,
    fetchLimit: options.fetchLimit,
    textOrClause: options.textOrClause,
    categoryIds,
    bbox: spatialIds ? null : bboxLegacy,
    centerBbox: null,
    bboxListingIds: spatialIds,
    spatialListingIds: null,
    includeTextSearchOr: options.includeTextSearchOr !== false,
    discoveryPlan: plan,
  })

  q = applyDiscoveryScalarFiltersFromPlan(q, plan)

  const { data, error } = await q
  return { data, error, plan }
}

/**
 * Whether unified path already applied GiST bbox (skip JS pointInBounds).
 * @param {DiscoveryQueryPlan|null|undefined} plan
 * @returns {boolean}
 */
export function discoveryPlanUsedGistBbox(plan) {
  return Boolean(
    plan &&
      plan.registryFiltersApplied?.includes('geo.bbox') &&
      plan.spatial?.engine === 'postgis' &&
      Array.isArray(plan.spatial.listingIds),
  )
}

/**
 * @param {DiscoveryQueryPlan|null|undefined} plan
 * @returns {string[]}
 */
export function discoveryRegistryFiltersMeta(plan) {
  return plan?.registryFiltersApplied ? [...plan.registryFiltersApplied] : []
}
