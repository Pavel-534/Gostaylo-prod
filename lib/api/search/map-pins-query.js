/**
 * Stage 163.0–163.1 — lean map pins query (no owner/images joins) + GiST bbox SSOT.
 * Uses `listings` (true coords) server-side; public output fuzzed in serializeMapPinRow.
 * PostgREST anon: `listings_public_catalog` only (Stage 168.0).
 */
import { buildSmartWhereOrClause } from '@/lib/api/search/location-filter'
import { getPostgisSpatialState } from '@/lib/api/postgis-probe'
import { serializePublicCoordinates } from '@/lib/geo/listing-public-coordinates'
import { coordinateRevealLevelForListing } from '@/lib/geo/public-coordinate-viewer-context'
import { traceSpatialQuery } from '@/lib/ops/slow-query-log'
import {
  getSpatialCache,
  setSpatialCache,
  spatialBboxCacheKey,
  recordSpatialCacheHit,
  recordSpatialCacheMiss,
} from '@/lib/ops/spatial-query-cache'

import { getMapPinGuestDisplayThb } from '@/lib/pricing/guest-display-price.js'

/** Minimal row for map markers + availability/capacity post-filters. */
export const MAP_PINS_SELECT = `
  id,
  latitude,
  longitude,
  base_price_thb,
  commission_rate,
  status,
  max_capacity,
  metadata,
  category_id,
  bedrooms_count,
  bathrooms_count,
  instant_booking,
  categories (slug, wizard_profile)
`

/**
 * GiST bbox → listing ids (PostGIS). Returns null if probe/RPC unavailable.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {{ south: number, west: number, north: number, east: number }} bbox
 * @param {number} [limit]
 * @returns {Promise<string[] | null>}
 */
export async function fetchBboxListingIdsGiST(supabaseAdmin, bbox, limit = 500) {
  const state = await getPostgisSpatialState()
  if (!state.postgisSpatialSearch || !bbox) return null

  const cacheKey = spatialBboxCacheKey(bbox, `gist:${limit}`)
  const cached = getSpatialCache(cacheKey)
  if (cached.hit && Array.isArray(cached.value)) {
    recordSpatialCacheHit()
    return cached.value
  }
  recordSpatialCacheMiss()

  try {
    const { result: data } = await traceSpatialQuery(
      'gist_bbox_lookup',
      { bbox, limit },
      async () => {
        const { data: rows, error } = await supabaseAdmin.rpc('listings_map_pin_ids_in_bbox_gist_v1', {
          p_south: bbox.south,
          p_west: bbox.west,
          p_north: bbox.north,
          p_east: bbox.east,
          p_limit: limit,
        })
        if (error) throw error
        return rows
      },
    )

    const ids = (data || [])
      .map((row) => (typeof row === 'string' ? row : row?.id))
      .filter(Boolean)
      .map(String)

    setSpatialCache(cacheKey, ids)
    return ids
  } catch (error) {
    console.warn('[map-pins-query] GiST bbox RPC failed:', error?.message || error)
    return null
  }
}

/**
 * Legacy lat/lng range (fallback when coordinates/GiST unavailable).
 *
 * @param {import('@supabase/supabase-js').PostgrestFilterBuilder} q
 * @param {{ south: number, west: number, north: number, east: number }} bbox
 */
export function applyLatLngBboxFilter(q, bbox) {
  return q
    .gte('latitude', bbox.south)
    .lte('latitude', bbox.north)
    .gte('longitude', bbox.west)
    .lte('longitude', bbox.east)
}

/**
 * @param {object} p
 * @param {string[] | null} [p.bboxListingIds] — GiST prefilter ids; null = use lat/lng bbox
 */
export async function buildMapPinsQuery({
  supabaseAdmin,
  filters,
  fetchLimit,
  textOrClause,
  categoryIds,
  bbox,
  centerBbox,
  bboxListingIds = null,
  spatialListingIds = null,
  includeTextSearchOr = false,
  /** @type {'legacy'|'unified'} [amenitiesMode] */
  amenitiesMode = 'legacy',
  /** @type {import('@/lib/search/filter-registry').DiscoveryQueryPlan|null} [discoveryPlan] */
  discoveryPlan = null,
}) {
  const useUnifiedPlan = Boolean(discoveryPlan)
  let q = supabaseAdmin
    .from('listings')
    .select(MAP_PINS_SELECT)
    .eq('status', 'ACTIVE')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .order('created_at', { ascending: false })
    .limit(fetchLimit)

  if (includeTextSearchOr && textOrClause) {
    q = q.or(textOrClause)
  }

  if (filters.where && filters.where !== 'all') {
    const whereOrClause = await buildSmartWhereOrClause(filters.where)
    if (whereOrClause) q = q.or(whereOrClause)
  } else {
    if (filters.city && filters.city !== 'all') {
      q = q.contains('metadata', { city: filters.city })
    }
    if (filters.location && filters.location !== 'all') {
      q = q.ilike('district', `%${filters.location}%`)
    }
  }

  if (categoryIds?.length) {
    q = categoryIds.length === 1 ? q.eq('category_id', categoryIds[0]) : q.in('category_id', categoryIds)
  }

  if (spatialListingIds != null) {
    if (spatialListingIds.length === 0) {
      q = q.in('id', ['__spatial_empty__'])
    } else if (spatialListingIds.length === 1) {
      q = q.eq('id', spatialListingIds[0])
    } else {
      q = q.in('id', spatialListingIds)
    }
  }

  const dbBbox = bbox || centerBbox
  if (bboxListingIds != null) {
    if (bboxListingIds.length === 0) {
      q = q.in('id', ['__gist_bbox_empty__'])
    } else if (bboxListingIds.length === 1) {
      q = q.eq('id', bboxListingIds[0])
    } else {
      q = q.in('id', bboxListingIds)
    }
  } else if (dbBbox) {
    q = applyLatLngBboxFilter(q, dbBbox)
  }

  if (!useUnifiedPlan) {
    const skipSqlPriceBecauseCalendar =
      filters.checkIn &&
      filters.checkOut &&
      String(filters.checkIn) < String(filters.checkOut)

    if (!skipSqlPriceBecauseCalendar && filters.minPrice) {
      q = q.gte('base_price_thb', filters.minPrice)
    }
    if (!skipSqlPriceBecauseCalendar && filters.maxPrice) {
      q = q.lte('base_price_thb', filters.maxPrice)
    }
    if (filters.instantBookingOnly) {
      q = q.eq('instant_booking', true)
    }
    if (Number.isFinite(filters.bedroomsMin) && filters.bedroomsMin > 0) {
      q = q.gte('bedrooms_count', filters.bedroomsMin)
    }
    if (Number.isFinite(filters.bathroomsMin) && filters.bathroomsMin > 0) {
      q = q.gte('bathrooms_count', filters.bathroomsMin)
    }
    if (filters.amenities?.length) {
      if (amenitiesMode === 'unified') {
        q = q.contains('metadata', { amenities: [...filters.amenities] })
      } else {
        for (const amenitySlug of filters.amenities) {
          q = q.contains('metadata', { amenities: [amenitySlug] })
        }
      }
    }
  }

  /** Non-thenable wrapper — async return of PostgREST chain would execute the query early. */
  return { query: q }
}

/**
 * @param {object} row
 * @param {import('@/lib/geo/public-coordinate-viewer-context').PublicCoordinateViewerContext | {
 *   viewerContext?: import('@/lib/geo/public-coordinate-viewer-context').PublicCoordinateViewerContext | null,
 *   guestServiceFeePercent?: number,
 * } | null} [viewerContextOrOptions]
 */
export function mapPinRowToPayload(row, viewerContextOrOptions = null) {
  const options =
    viewerContextOrOptions &&
    typeof viewerContextOrOptions === 'object' &&
    ('guestServiceFeePercent' in viewerContextOrOptions || 'viewerContext' in viewerContextOrOptions)
      ? viewerContextOrOptions
      : { viewerContext: viewerContextOrOptions }

  const viewerContext = options.viewerContext ?? null
  const reveal = viewerContext ? coordinateRevealLevelForListing(row, viewerContext) : 'public_fuzz'
  const coords = serializePublicCoordinates(row, reveal)
  if (coords.latitude == null || coords.longitude == null) return null
  const guestThb = getMapPinGuestDisplayThb(row, options.guestServiceFeePercent)
  return {
    id: String(row.id),
    lat: coords.latitude,
    lng: coords.longitude,
    price: guestThb > 0 ? guestThb : null,
    status: String(row.status || 'ACTIVE'),
    isApproximate: coords.isApproximate,
    locationPrivacyMode: coords.locationPrivacyMode,
  }
}
