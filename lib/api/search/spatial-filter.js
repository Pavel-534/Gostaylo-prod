/**
 * Stage 162.2 — spatial radius filter + KNN distance map (PostGIS RPC + Haversine fallback).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { firstFloatParam, haversineKm } from '@/lib/api/search/params'
import { getPostgisSpatialState } from '@/lib/api/postgis-probe'
import { traceSpatialQuery } from '@/lib/ops/slow-query-log'
import {
  getSpatialCache,
  setSpatialCache,
  spatialRadiusCacheKey,
  recordSpatialCacheHit,
  recordSpatialCacheMiss,
} from '@/lib/ops/spatial-query-cache'

const DEFAULT_RADIUS_KM = 50
const MAX_SPATIAL_IDS = 3000

/**
 * @typedef {Object} SpatialRadiusHit
 * @property {string[]} orderedIds
 * @property {Map<string, number>} distanceKmById
 * @property {'postgis' | 'haversine'} engine
 */

/**
 * @param {number} km
 */
export function roundDistanceKm(km) {
  const n = Number(km)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 1000) / 1000
}

/**
 * @param {URLSearchParams} searchParams
 * @returns {{ lat: number, lon: number, radiusKm: number } | null}
 */
export function parseSpatialRadiusFromSearchParams(searchParams) {
  const lat = firstFloatParam(searchParams, 'lat')
  const lon = firstFloatParam(searchParams, 'lng', 'lon')
  const radiusRaw = firstFloatParam(searchParams, 'radius', 'radiusKm')
  const radiusKm =
    Number.isFinite(radiusRaw) && radiusRaw > 0 ? radiusRaw : DEFAULT_RADIUS_KM

  if (lat == null || lon == null) return null
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null
  return { lat, lon, radiusKm }
}

/**
 * @param {URLSearchParams} searchParams
 * @param {boolean} geoCenter
 */
export function parseSpatialSortUsed(searchParams, geoCenter) {
  if (!geoCenter) return false
  const sort = String(searchParams.get('sort') || '').trim().toLowerCase()
  return sort === 'distance' || sort === ''
}

/**
 * @param {{ lat?: number | null, lon?: number | null, radiusKm?: number }} spatial
 */
export function spatialRadiusActive(spatial) {
  return (
    spatial != null &&
    Number.isFinite(spatial.lat) &&
    Number.isFinite(spatial.lon) &&
    Number.isFinite(spatial.radiusKm) &&
    spatial.radiusKm > 0
  )
}

/**
 * PostGIS KNN path. Returns null → caller builds Haversine map from listing rows.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {number} radiusKm
 * @returns {Promise<SpatialRadiusHit | null>}
 */
export async function fetchListingDistancesWithinRadius(lat, lon, radiusKm) {
  const state = await getPostgisSpatialState()
  if (!state.postgisSpatialSearch) return null

  const cacheKey = spatialRadiusCacheKey(lat, lon, radiusKm, 'knn')
  const cached = getSpatialCache(cacheKey)
  if (cached.hit && cached.value) {
    recordSpatialCacheHit()
    return cached.value
  }
  recordSpatialCacheMiss()

  let data
  try {
    const traced = await traceSpatialQuery(
      'knn_radius',
      { lat, lon, radiusKm },
      async () => {
        const { data: rows, error } = await supabaseAdmin.rpc('listings_ids_within_radius_v1', {
          p_lat: lat,
          p_lng: lon,
          p_radius_m: radiusKm * 1000,
        })
        if (error) throw error
        return rows
      },
    )
    data = traced.result
  } catch (error) {
    console.warn('[spatial-filter] RPC listings_ids_within_radius_v1 failed:', error?.message || error)
    return null
  }

  const orderedIds = []
  const distanceKmById = new Map()

  for (const row of data || []) {
    const id = String(row?.listing_id ?? row?.id ?? '')
    if (!id) continue
    const meters = Number(row?.distance_meters)
    if (!Number.isFinite(meters)) continue
    orderedIds.push(id)
    distanceKmById.set(id, roundDistanceKm(meters / 1000))
    if (orderedIds.length >= MAX_SPATIAL_IDS) break
  }

  const hit = { orderedIds, distanceKmById, engine: 'postgis' }
  setSpatialCache(cacheKey, hit)
  return hit
}

/** @deprecated Stage 162.2 — use fetchListingDistancesWithinRadius */
export async function fetchListingIdsWithinRadius(lat, lon, radiusKm) {
  const hit = await fetchListingDistancesWithinRadius(lat, lon, radiusKm)
  return hit?.orderedIds ?? null
}

/**
 * Haversine fallback: filter in-radius listings + distance map (KNN order).
 *
 * @param {object[]} listings
 * @param {{ lat: number, lon: number, radiusKm: number }} spatial
 * @returns {SpatialRadiusHit & { listings: object[] }}
 */
export function buildHaversineDistanceMapForListings(listings, spatial) {
  const inRadius = []
  const distanceKmById = new Map()

  for (const listing of listings) {
    const lat = parseFloat(listing.latitude)
    const lon = parseFloat(listing.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const km = haversineKm(spatial.lat, spatial.lon, lat, lon)
    if (km > spatial.radiusKm) continue
    const id = String(listing.id)
    const rounded = roundDistanceKm(km)
    distanceKmById.set(id, rounded)
    inRadius.push({ listing, km: rounded })
  }

  inRadius.sort((a, b) => a.km - b.km)

  return {
    orderedIds: inRadius.map((row) => String(row.listing.id)),
    distanceKmById,
    listings: inRadius.map((row) => row.listing),
    engine: 'haversine',
  }
}

/**
 * @param {object[]} listings
 * @param {Map<string, number>} distanceKmById
 */
export function sortListingsByDistance(listings, distanceKmById) {
  return [...listings].sort((a, b) => {
    const da = distanceKmById.get(String(a.id))
    const db = distanceKmById.get(String(b.id))
    const aDist = Number.isFinite(da) ? da : Number.POSITIVE_INFINITY
    const bDist = Number.isFinite(db) ? db : Number.POSITIVE_INFINITY
    return aDist - bDist
  })
}

/**
 * Keep only listings present in the spatial distance map (PostGIS pre-filter path).
 *
 * @param {object[]} listings
 * @param {Map<string, number>} distanceKmById
 */
export function filterListingsToSpatialDistanceMap(listings, distanceKmById) {
  if (!distanceKmById?.size) return []
  return listings.filter((l) => distanceKmById.has(String(l.id)))
}
