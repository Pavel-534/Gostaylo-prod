/**
 * Stage 177.1–177.2c — execute unified discovery SQL plan (category → bbox → facets → cursor → availability).
 * Stage 177.3 — transport/yacht JSONB predicates via applyDiscoveryScalarFiltersFromPlan (before cursor keyset).
 */
import { applyDiscoveryCursorToQuery } from '@/lib/api/search/discovery-cursor-sql'
import {
  applyDiscoveryScalarFiltersFromPlan,
  legacyFiltersForUnifiedDiscoveryPlan,
} from '@/lib/api/search/discovery-scalar-sql'
import {
  buildDiscoveryCursorFromListingRow,
  slicePageAndBuildNextCursor,
} from '@/lib/search/discovery-cursor-page'
import {
  applyDiscoveryAvailabilityToPage,
  discoveryPlanHasAvailabilityStep,
} from '@/lib/search/discovery-availability-page'
import { discoveryCursorRefillIfSparse } from '@/lib/search/discovery-cursor-refill'

export { slicePageAndBuildNextCursor } from '@/lib/search/discovery-cursor-page'

/** @typedef {import('@/lib/search/filter-registry').DiscoveryQueryPlan} DiscoveryQueryPlan */

/**
 * @param {DiscoveryQueryPlan} plan
 */
async function resolveSpatialListingIds(plan) {
  const { resolveSpatialListingIdsFromPlan } = await import('@/lib/api/search/discovery-spatial-rpc')
  return resolveSpatialListingIdsFromPlan(plan)
}

/**
 * @param {DiscoveryQueryPlan} plan
 * @param {{
 *   legacyFilters: object,
 *   fetchLimit?: number,
 *   textOrClause: string|null,
 *   includeTextSearchOr?: boolean,
 *   listingsSelect: string,
 * }} options
 * @param {string|null|undefined} [cursorOverride]
 */
async function runDiscoveryListingsQuery(plan, options, cursorOverride = undefined) {
  const [{ supabaseAdmin }, { buildListingsQuery }] = await Promise.all([
    import('@/lib/supabase'),
    import('@/lib/api/search/query-builder'),
  ])
  const spatialIds = await resolveSpatialListingIds(plan)

  const categoryIds = plan.sql.categoryIds
  const bboxLegacy = plan.spatial.bboxLegacy
  const queryFilters = legacyFiltersForUnifiedDiscoveryPlan(options.legacyFilters, plan)

  const usesCursorPagination = plan.sql?.paginationMode === 'cursor'
  const fetchLimit = options.fetchLimit ?? plan.sql.fetchLimit
  const cursor =
    cursorOverride !== undefined ? cursorOverride : plan.sql.cursor

  let { query: q } = await buildListingsQuery({
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
      cursor,
      plan.sql.orderBy,
      plan.sql.pageSize,
      plan.sql.overFetch ?? 1,
    )
  }

  return q
}

/**
 * @param {object[]} acceptedRows
 * @param {boolean} sqlHasMore
 * @param {number} pageSize
 * @returns {{ nextCursor: string|null, hasMore: boolean }}
 */
function buildAcceptedCursorPagination(acceptedRows, sqlHasMore, pageSize) {
  const capped = acceptedRows.length > pageSize ? acceptedRows.slice(0, pageSize) : acceptedRows
  const hasMore = Boolean(sqlHasMore)
  const lastAccepted = capped.length > 0 ? capped[capped.length - 1] : null
  const nextCursor =
    hasMore && lastAccepted ? buildDiscoveryCursorFromListingRow(lastAccepted) : null

  return { nextCursor, hasMore }
}

/**
 * Cascade: category (SQL) → bbox GiST ids → plan scalar/jsonb facets → cursor keyset → availability post-steps.
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
 *   pagination?: {
 *     mode: 'cursor',
 *     pageSize: number,
 *     next_cursor: string|null,
 *     hasMore: boolean,
 *     refillAttempts?: number,
 *   },
 *   availabilityStats?: import('@/lib/search/discovery-availability-page').DiscoveryAvailabilityPageStats,
 * }>}
 */
export async function executeDiscoverySqlPlan(plan, options) {
  const usesCursorPagination = plan.sql?.paginationMode === 'cursor'
  const { data, error } = await runDiscoveryListingsQuery(plan, options)

  if (!usesCursorPagination) {
    if (discoveryPlanHasAvailabilityStep(plan)) {
      const { rows, stats } = await applyDiscoveryAvailabilityToPage(data || [], plan)
      return { data: rows, error, plan, availabilityStats: stats }
    }
    return { data, error, plan }
  }

  const pageSize = plan.sql.pageSize ?? 24
  const { pageRows, nextCursor: sqlNextCursor, hasMore: sqlHasMore } = slicePageAndBuildNextCursor(
    data,
    pageSize,
  )

  if (!discoveryPlanHasAvailabilityStep(plan)) {
    return {
      data: pageRows,
      error,
      plan,
      nextCursor: sqlNextCursor,
      pagination: {
        mode: 'cursor',
        pageSize,
        next_cursor: sqlNextCursor,
        hasMore: sqlHasMore,
      },
    }
  }

  const { rows: acceptedInitial, stats: availabilityStats } =
    await applyDiscoveryAvailabilityToPage(pageRows, plan)

  if (acceptedInitial.length < pageSize && sqlHasMore) {
    const refill = await discoveryCursorRefillIfSparse(
      acceptedInitial,
      pageRows,
      plan,
      async (internalCursor) => {
        const q = await runDiscoveryListingsQuery(plan, options, internalCursor)
        const { data: nextData, error: nextError } = await q
        return { data: nextData, error: nextError }
      },
      { sqlHasMore, sqlNextCursor, pageSize },
    )

    return {
      data: refill.acceptedRows,
      error,
      plan,
      nextCursor: refill.nextCursor,
      pagination: {
        mode: 'cursor',
        pageSize,
        next_cursor: refill.nextCursor,
        hasMore: refill.hasMore,
        refillAttempts: refill.refillAttempts,
      },
      availabilityStats,
    }
  }

  const capped =
    acceptedInitial.length > pageSize ? acceptedInitial.slice(0, pageSize) : acceptedInitial
  const { nextCursor, hasMore } = buildAcceptedCursorPagination(capped, sqlHasMore, pageSize)

  return {
    data: capped,
    error,
    plan,
    nextCursor,
    pagination: {
      mode: 'cursor',
      pageSize,
      next_cursor: nextCursor,
      hasMore,
    },
    availabilityStats,
  }
}

/**
 * @param {DiscoveryQueryPlan} plan
 * @returns {Promise<{ listingIds: string[]|null, plan: DiscoveryQueryPlan }>}
 */
export async function executeDiscoverySpatialPrefilter(plan) {
  const ids = await resolveSpatialListingIds(plan)
  return { listingIds: ids, plan }
}

/**
 * Map pins SQL slice — same cascade as catalog (category → bbox ids → housing facets → availability).
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
  const [{ supabaseAdmin }, { buildMapPinsQuery }] = await Promise.all([
    import('@/lib/supabase'),
    import('@/lib/api/search/map-pins-query'),
  ])
  const spatialIds = await resolveSpatialListingIds(plan)
  const categoryIds = plan.sql.categoryIds
  const bboxLegacy = plan.spatial.bboxLegacy
  const queryFilters = legacyFiltersForUnifiedDiscoveryPlan(options.legacyFilters, plan)

  let { query: q } = await buildMapPinsQuery({
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

  if (discoveryPlanHasAvailabilityStep(plan)) {
    const { rows, stats } = await applyDiscoveryAvailabilityToPage(data || [], plan)
    return { data: rows, error, plan, availabilityStats: stats }
  }

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
