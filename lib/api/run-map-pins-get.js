/**
 * Stage 163.0 — GET /api/v2/search/map-pins (lean map read-path).
 */
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimitCheck } from '@/lib/rate-limit'
import { toListingDate } from '@/lib/listing-date'
import { normalizeListingCategorySlugForSearch } from '@/lib/listing-category-slug'
import { resolveListingCategoryIdsForSearchScope } from '@/lib/api/category-search-scope'
import {
  buildMetadataFiltersFromSearchParams,
  listingMatchesMetadataFilters,
  metadataFiltersActive,
} from '@/lib/search/listing-metadata-filter'
import { isExcludedFromPublicCatalog } from '@/lib/e2e/test-listing-cleanup'
import {
  buildTextSearchOr,
  parseMapBounds,
  listingLatLngRaw,
  pointInBounds,
  firstFloatParam,
  firstIntParam,
  parseBooleanSearchParam,
  parseAmenitiesFromSearchParams,
  sqlMetadataFiltersActive,
  normalizeRadiusBoundingBox,
} from '@/lib/api/search/params'
import {
  parseSpatialRadiusFromSearchParams,
  spatialRadiusActive,
  fetchListingDistancesWithinRadius,
  buildHaversineDistanceMapForListings,
  filterListingsToSpatialDistanceMap,
} from '@/lib/api/search/spatial-filter'
import { buildMapPinsQuery, mapPinRowToPayload, fetchBboxListingIdsGiST } from '@/lib/api/search/map-pins-query'
import { getCommissionRate } from '@/lib/commission/get-commission-rate-server.js'
import { normalizeGuestServiceFeePercent } from '@/lib/pricing/guest-display-price.js'
import { fetchPublicCoordinateViewerContext } from '@/lib/geo/public-coordinate-viewer-context'
import { filterListingsByAvailability } from '@/lib/api/search/availability'
import { listingMatchesSearchPriceRange } from '@/lib/search/effective-unit-price-for-search'
import { getPostgisSpatialState } from '@/lib/api/postgis-probe'
import { recordMapPinsMetrics } from '@/lib/geo/map-pins-metrics'
import { logGeoMapSearch } from '@/lib/geo/geo-search-log'
import { traceSpatialQuery } from '@/lib/ops/slow-query-log'
import { assertSpatialCircuitClosed } from '@/lib/ops/spatial-circuit-breaker'
import {
  getSpatialCache,
  setSpatialCache,
  spatialBboxCacheKey,
  recordSpatialCacheHit,
  recordSpatialCacheMiss,
} from '@/lib/ops/spatial-query-cache'
import { isDiscoveryUnifiedPipelineEnabled } from '@/lib/search/discovery-pipeline-flag'
import { parseDiscoveryFiltersFromSearchParams } from '@/lib/search/discovery-filter-contract'
import { buildDiscoveryQueryPlan } from '@/lib/search/discovery-query-plan'
import {
  executeMapPinsDiscoverySqlPlan,
  discoveryPlanUsedGistBbox,
  discoveryRegistryFiltersMeta,
} from '@/lib/search/discovery-query-executor'
import {
  discoveryPlanHasAvailabilityStep,
  discoveryPlanHasCalendarPriceStep,
} from '@/lib/search/discovery-availability-page'
import { metadataFiltersForJsPostFilter } from '@/lib/search/discovery-metadata-facet-page'
import {
  mapPinsEdgeCacheControl,
  edgeCacheResponseHeaders,
  PRIVATE_NO_STORE_CACHE_CONTROL,
} from '@/lib/api/public-edge-cache-control.js'

export const MAP_PINS_MAX = 500
export const MAP_CLUSTER_THRESHOLD = 200

/**
 * @param {unknown} body
 * @param {number} status
 * @param {string | null | undefined} viewerId
 */
function mapPinsJson(body, status, viewerId) {
  return NextResponse.json(body, {
    status,
    headers: edgeCacheResponseHeaders(mapPinsEdgeCacheControl({ viewerId, status })),
  })
}

/**
 * @param {Request} request
 */
export async function runMapPinsGet(request) {
  const startedAt = Date.now()
  const rl = await rateLimitCheck(request, 'spatial_map')
  if (rl) {
    return NextResponse.json(rl.body, {
      status: rl.status,
      headers: {
        ...rl.headers,
        'Cache-Control': PRIVATE_NO_STORE_CACHE_CONTROL,
      },
    })
  }

  try {
    assertSpatialCircuitClosed('map_pins')
  } catch (e) {
    if (e?.code === 'SPATIAL_CIRCUIT_OPEN') {
      return mapPinsJson(
        { success: false, error: 'Map temporarily unavailable', code: 'SPATIAL_CIRCUIT_OPEN' },
        503,
        null,
      )
    }
    throw e
  }

  try {
    const coordViewerContext = await fetchPublicCoordinateViewerContext()
    const viewerId = coordViewerContext?.viewerId ?? null

    const { searchParams } = new URL(request.url)
    const normalizedCheckIn = toListingDate(searchParams.get('checkIn'))
    const normalizedCheckOut = toListingDate(searchParams.get('checkOut'))
    const hasValidDateRange = Boolean(
      normalizedCheckIn && normalizedCheckOut && normalizedCheckIn < normalizedCheckOut,
    )

    const spatialRadius = parseSpatialRadiusFromSearchParams(searchParams)
    const metadataFilters = buildMetadataFiltersFromSearchParams(searchParams)

    const filters = {
      q: searchParams.get('q'),
      where: searchParams.get('where'),
      location: searchParams.get('location'),
      city: searchParams.get('city'),
      lat: spatialRadius?.lat ?? null,
      lon: spatialRadius?.lon ?? null,
      radiusKm: spatialRadius?.radiusKm ?? 50,
      category: normalizeListingCategorySlugForSearch(searchParams.get('category')),
      checkIn: hasValidDateRange ? normalizedCheckIn : null,
      checkOut: hasValidDateRange ? normalizedCheckOut : null,
      guests: parseInt(searchParams.get('guests'), 10) || null,
      instantBookingOnly: parseBooleanSearchParam(searchParams, 'instant_booking', 'instantBooking') === true,
      bedroomsMin: firstIntParam(searchParams, 'bedrooms', 'bedrooms_min'),
      bathroomsMin: firstIntParam(searchParams, 'bathrooms', 'bathrooms_min'),
      amenities: parseAmenitiesFromSearchParams(searchParams),
      minPrice: firstFloatParam(searchParams, 'min_price', 'minPrice'),
      maxPrice: firstFloatParam(searchParams, 'max_price', 'maxPrice'),
      limit: Math.min(parseInt(searchParams.get('limit'), 10) || MAP_PINS_MAX, MAP_PINS_MAX),
      mapBounds: parseMapBounds(searchParams),
      metadataFilters,
      softAvailability: searchParams.get('softAvailability') !== '0',
      forceClusters: searchParams.get('cluster') === '1',
    }

    const bbox = filters.mapBounds
    const geoCenter = spatialRadiusActive(spatialRadius)
    const centerBbox = geoCenter ? normalizeRadiusBoundingBox(filters.lat, filters.lon, filters.radiusKm) : null

    const unifiedPipeline = isDiscoveryUnifiedPipelineEnabled()
    /** @type {import('@/lib/search/filter-registry').DiscoveryQueryPlan|null} */
    let discoveryPlan = null

    if (unifiedPipeline) {
      const parsed = await parseDiscoveryFiltersFromSearchParams(searchParams, { surface: 'map' })
      if (!parsed.ok) {
        return mapPinsJson(
          {
            success: false,
            error: 'Invalid search parameters',
            code: 'DISCOVERY_FILTER_INVALID',
            issues: parsed.issues,
          },
          400,
          viewerId,
        )
      }
      discoveryPlan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'map' })
    }

    const polygonSpatialActive = discoveryPlan?.spatial?.rpc === 'listings_within_polygon_v1'

    if (!bbox && !geoCenter && !polygonSpatialActive) {
      return mapPinsJson(
        {
          success: false,
          error: 'map-pins requires viewport bounds (south,north,west,east), lat/lng radius, or polygon',
          code: 'MAP_BOUNDS_REQUIRED',
        },
        400,
        viewerId,
      )
    }

    const categoryIds =
      filters.category && filters.category !== 'all'
        ? await resolveListingCategoryIdsForSearchScope(filters.category)
        : null

    let spatialHit = null
    if (geoCenter) {
      spatialHit = await fetchListingDistancesWithinRadius(filters.lat, filters.lon, filters.radiusKm)
    }
    const spatialListingIds = spatialHit?.orderedIds ?? null
    let distanceKmById = spatialHit?.distanceKmById ?? new Map()

    const postgisState = await getPostgisSpatialState()
    let bboxPinCount = null
    let serverClusters = null

    // Stage 177.5.0 — polygon mode skips bbox grid clusters (wrong spatial set until 177.5.x clip).
    if (bbox && postgisState.postgisSpatialSearch && !polygonSpatialActive) {
      const catSuffix = categoryIds?.length ? categoryIds.join(',') : 'all'
      const countKey = spatialBboxCacheKey(bbox, `count:${catSuffix}`)
      const countCached = getSpatialCache(countKey)
      if (countCached.hit && countCached.value != null) {
        recordSpatialCacheHit()
        bboxPinCount = Number(countCached.value)
      } else {
        recordSpatialCacheMiss()
        try {
          const { result: countVal } = await traceSpatialQuery(
            'bbox_pin_count',
            { bbox },
            async () => {
              const { data, error } = await supabaseAdmin.rpc('listings_map_bbox_pin_count_v1', {
                p_south: bbox.south,
                p_west: bbox.west,
                p_north: bbox.north,
                p_east: bbox.east,
                p_category_ids: categoryIds?.length ? categoryIds : null,
              })
              if (error) throw error
              return data
            },
          )
          if (countVal != null) {
            bboxPinCount = Number(countVal)
            setSpatialCache(countKey, bboxPinCount)
          }
        } catch (countErr) {
          console.warn('[MAP PINS API] bbox count failed:', countErr?.message || countErr)
        }
      }

      const wantClusters =
        filters.forceClusters || (Number.isFinite(bboxPinCount) && bboxPinCount > MAP_CLUSTER_THRESHOLD)

      if (wantClusters) {
        const cellM = parseFloat(searchParams.get('clusterCellM') || '') || 3500
        const clusterKey = spatialBboxCacheKey(bbox, `clusters:${cellM}:${catSuffix}`)
        const clusterCached = getSpatialCache(clusterKey)
        let clusterRows = null
        if (clusterCached.hit && Array.isArray(clusterCached.value)) {
          recordSpatialCacheHit()
          clusterRows = clusterCached.value
        } else {
          recordSpatialCacheMiss()
          try {
            const { result } = await traceSpatialQuery(
              'map_clusters_grid',
              { bbox, cellM },
              async () => {
                const { data, error } = await supabaseAdmin.rpc('listings_map_clusters_grid_v1', {
                  p_south: bbox.south,
                  p_west: bbox.west,
                  p_north: bbox.north,
                  p_east: bbox.east,
                  p_cell_size_m: cellM,
                  p_category_ids: categoryIds?.length ? categoryIds : null,
                })
                if (error) throw error
                return data
              },
            )
            clusterRows = result
            if (Array.isArray(clusterRows)) setSpatialCache(clusterKey, clusterRows)
          } catch (clusterErr) {
            console.warn('[MAP PINS API] clusters failed:', clusterErr?.message || clusterErr)
          }
        }
        if (Array.isArray(clusterRows)) {
          const cellSizeM = parseFloat(searchParams.get('clusterCellM') || '') || 3500
          serverClusters = clusterRows.map((c) => ({
            clusterId: Number(c.cluster_id),
            count: Number(c.pin_count),
            lat: Number(c.centroid_lat),
            lng: Number(c.centroid_lng),
            minPrice: c.min_price_thb != null ? Number(c.min_price_thb) : null,
            listingIds: Array.isArray(c.listing_ids) ? c.listing_ids.map(String) : [],
            isApproximate: true,
            cellSizeM,
          }))
        }
      }
    }

    if (serverClusters?.length) {
      const latencyMs = Date.now() - startedAt
      recordMapPinsMetrics({
        durationMs: latencyMs,
        mode: 'clusters',
        clusterCount: serverClusters.length,
        bboxPinCount,
        approximateClusters: serverClusters.filter((c) => c.isApproximate).length,
      })
      logGeoMapSearch({
        bbox,
        mode: 'clusters',
        clustersReturned: serverClusters.length,
        pinsReturned: 0,
        latencyMs,
        bboxPinCount,
      })
      return mapPinsJson(
        {
          success: true,
          data: {
            mode: 'clusters',
            clusters: serverClusters,
            pins: [],
            meta: {
              bboxPinCount,
              clusterThreshold: MAP_CLUSTER_THRESHOLD,
              clusterCellM: parseFloat(searchParams.get('clusterCellM') || '') || 3500,
              clusterCentroidMode: 'grid_cell_center',
              postgis: true,
            },
          },
        },
        200,
        viewerId,
      )
    }

    const textOrClause = buildTextSearchOr(filters.q)
    const fetchLimit = Math.min(Math.max(filters.limit, 100), MAP_PINS_MAX)

    let bboxListingIds = null
    let gistBboxUsed = false
    let rawRows
    let error
    /** @type {import('@/lib/search/discovery-availability-page').DiscoveryAvailabilityPageStats | null} */
    let discoveryAvailabilityStats = null

    if (unifiedPipeline && discoveryPlan) {
      const unifiedResult = await executeMapPinsDiscoverySqlPlan(discoveryPlan, {
        legacyFilters: filters,
        fetchLimit,
        textOrClause,
        includeTextSearchOr: true,
      })
      rawRows = unifiedResult.data
      error = unifiedResult.error
      discoveryPlan = unifiedResult.plan
      discoveryAvailabilityStats = unifiedResult.availabilityStats ?? null
      if (discoveryPlanUsedGistBbox(discoveryPlan)) {
        gistBboxUsed = true
        bboxListingIds = discoveryPlan.spatial.listingIds
      }
    } else {
      if (bbox) {
        bboxListingIds = await fetchBboxListingIdsGiST(supabaseAdmin, bbox, fetchLimit)
        if (bboxListingIds != null) gistBboxUsed = true
      }

      const { query: legacyQuery } = await buildMapPinsQuery({
        supabaseAdmin,
        filters,
        fetchLimit,
        textOrClause,
        categoryIds,
        bbox,
        centerBbox,
        bboxListingIds,
        spatialListingIds: geoCenter ? spatialListingIds : null,
        includeTextSearchOr: true,
      })
      const legacyResult = await legacyQuery
      rawRows = legacyResult.data
      error = legacyResult.error
    }

    if (error) {
      console.error('[MAP PINS API] Query error:', error)
      return mapPinsJson({ success: false, error: error.message }, 500, viewerId)
    }

    let rows = (rawRows || []).filter((row) => !isExcludedFromPublicCatalog(row))

    if (geoCenter && spatialRadius) {
      if (spatialHit) {
        rows = filterListingsToSpatialDistanceMap(rows, distanceKmById)
      } else {
        const haversineHit = buildHaversineDistanceMapForListings(rows, spatialRadius)
        rows = haversineHit.listings
        distanceKmById = haversineHit.distanceKmById
      }
    }

    if (bbox && !discoveryPlanUsedGistBbox(discoveryPlan)) {
      rows = rows.filter((l) => {
        const ll = listingLatLngRaw(l)
        if (!ll) return false
        return pointInBounds(ll.lat, ll.lng, bbox)
      })
    }

    const jsMetadataFilters = metadataFiltersForJsPostFilter(
      filters.metadataFilters,
      discoveryPlan,
      unifiedPipeline,
    )
    if (jsMetadataFilters) {
      rows = rows.filter((l) => listingMatchesMetadataFilters(l, jsMetadataFilters))
    }

    const executorHandledAvailability =
      unifiedPipeline && discoveryPlanHasAvailabilityStep(discoveryPlan)

    let availableListings
    let hasDateFilter = false

    if (executorHandledAvailability) {
      availableListings = rows
      hasDateFilter =
        discoveryAvailabilityStats?.hasDateFilter ??
        Boolean(filters.checkIn && filters.checkOut)
    } else {
      ;({ availableListings, hasDateFilter } = await filterListingsByAvailability(rows, filters, {
        allowSoftMismatch: filters.softAvailability,
      }))
    }

    const executorHandledCalendarPrice =
      executorHandledAvailability && discoveryPlanHasCalendarPriceStep(discoveryPlan)
    let finalRows = availableListings
    if (
      !executorHandledCalendarPrice &&
      hasDateFilter &&
      (filters.minPrice != null || filters.maxPrice != null)
    ) {
      finalRows = availableListings.filter((l) =>
        listingMatchesSearchPriceRange(l, filters.minPrice, filters.maxPrice),
      )
    }

    const commissionSnapshot = await getCommissionRate()
    const mapGuestFeePercent = normalizeGuestServiceFeePercent(
      commissionSnapshot?.guestServiceFeePercent,
    )
    const mapPinSerializeContext = {
      viewerContext: coordViewerContext,
      guestServiceFeePercent: mapGuestFeePercent,
    }

    const pins = finalRows
      .map((row) => mapPinRowToPayload(row, mapPinSerializeContext))
      .filter(Boolean)
      .slice(0, filters.limit)

    if (geoCenter) {
      for (const pin of pins) {
        const km = distanceKmById.get(pin.id)
        if (Number.isFinite(km)) pin.distance_from_center_km = km
      }
    }

    const latencyMs = Date.now() - startedAt
    recordMapPinsMetrics({
      durationMs: latencyMs,
      mode: 'pins',
      pinCount: pins.length,
      bboxPinCount,
    })
    logGeoMapSearch({
      bbox,
      mode: 'pins',
      clustersReturned: 0,
      pinsReturned: pins.length,
      latencyMs,
      bboxPinCount,
    })

    return mapPinsJson(
      {
        success: true,
        data: {
          mode: 'pins',
          pins,
          clusters: [],
          meta: {
            total: pins.length,
            bboxPinCount,
            clusterThreshold: MAP_CLUSTER_THRESHOLD,
            clusterRecommended:
              Number.isFinite(bboxPinCount) && bboxPinCount > MAP_CLUSTER_THRESHOLD,
            availabilityFiltered: hasDateFilter,
            postgis: postgisState.postgisSpatialSearch,
            gistBboxUsed,
            discoveryPipeline: unifiedPipeline ? 'unified' : 'legacy',
            discoveryPlanVersion: unifiedPipeline ? 1 : null,
            spatialEngine: discoveryPlan?.spatial?.engine ?? null,
            registryFiltersApplied: discoveryRegistryFiltersMeta(discoveryPlan),
          },
        },
      },
      200,
      viewerId,
    )
  } catch (e) {
    console.error('[MAP PINS API]', e)
    return mapPinsJson({ success: false, error: e?.message || 'Internal error' }, 500, null)
  }
}
