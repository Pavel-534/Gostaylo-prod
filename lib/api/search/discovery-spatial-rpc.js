/**
 * Stage 177.1 — PostGIS RPC wrappers for unified discovery spatial prefilter.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { getPostgisSpatialState } from '@/lib/api/postgis-probe'
import { traceSpatialQuery } from '@/lib/ops/slow-query-log'
import {
  getSpatialCache,
  setSpatialCache,
  spatialBboxCacheKey,
  recordSpatialCacheHit,
  recordSpatialCacheMiss,
} from '@/lib/ops/spatial-query-cache'
import { DISCOVERY_MAX_SPATIAL_IDS } from '@/lib/search/discovery-query-plan'

/**
 * @param {{ south: number, west: number, north: number, east: number, categoryIds?: string[]|null, limit?: number }} args
 * @returns {Promise<string[]|null>} null when PostGIS/RPC unavailable
 */
export async function fetchListingIdsInBboxGist(args) {
  const state = await getPostgisSpatialState()
  if (!state.postgisSpatialSearch) return null

  const bbox = {
    south: args.south,
    west: args.west,
    north: args.north,
    east: args.east,
  }
  const limit = args.limit ?? DISCOVERY_MAX_SPATIAL_IDS
  const catKey = args.categoryIds?.length ? args.categoryIds.join(',') : 'all'
  const cacheKey = spatialBboxCacheKey(bbox, `discovery177:${catKey}:${limit}`)
  const cached = getSpatialCache(cacheKey)
  if (cached.hit && Array.isArray(cached.value)) {
    recordSpatialCacheHit()
    return cached.value
  }
  recordSpatialCacheMiss()

  try {
    const { result: data } = await traceSpatialQuery(
      'discovery_bbox_gist_v1',
      { bbox, categoryIds: args.categoryIds, limit },
      async () => {
        const { data: rows, error } = await supabaseAdmin.rpc('listings_ids_in_bbox_gist_v1', {
          p_south: bbox.south,
          p_west: bbox.west,
          p_north: bbox.north,
          p_east: bbox.east,
          p_category_ids: args.categoryIds?.length ? args.categoryIds : null,
          p_limit: limit,
        })
        if (error) throw error
        return rows
      },
    )

    const ids = (data || [])
      .map((row) => (typeof row === 'string' ? row : row?.listing_id ?? row?.id))
      .filter(Boolean)
      .map(String)

    setSpatialCache(cacheKey, ids)
    return ids
  } catch (err) {
    console.warn('[discovery-spatial-rpc] listings_ids_in_bbox_gist_v1 failed:', err?.message || err)
    return null
  }
}

/**
 * @param {import('@/lib/search/filter-registry').DiscoveryQueryPlan} plan
 * @returns {Promise<string[]|null>}
 */
export async function resolveSpatialListingIdsFromPlan(plan) {
  if (plan.spatial?.listingIds) {
    return plan.spatial.listingIds
  }

  if (plan.spatial?.rpc !== 'listings_ids_in_bbox_gist_v1' || !plan.spatial.rpcArgs) {
    return null
  }

  const { south, west, north, east, categoryIds } = plan.spatial.rpcArgs
  const ids = await fetchListingIdsInBboxGist({
    south,
    west,
    north,
    east,
    categoryIds: categoryIds || null,
    limit: DISCOVERY_MAX_SPATIAL_IDS,
  })

  if (ids) {
    plan.spatial.listingIds = ids
    plan.spatial.engine = 'postgis'
    plan.sql.listingIds = ids
    return ids
  }

  plan.spatial.engine = 'bbox_fallback'
  plan.spatial.bboxLegacy = {
    south,
    north,
    west,
    east,
  }
  return null
}
