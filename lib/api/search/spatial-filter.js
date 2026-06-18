/**
 * Stage 162.1 — spatial radius filter for catalog search (PostGIS RPC + Haversine fallback).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { firstFloatParam, haversineKm } from '@/lib/api/search/params'
import { getPostgisSpatialState } from '@/lib/api/postgis-probe'

const DEFAULT_RADIUS_KM = 50
const MAX_SPATIAL_IDS = 3000

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
 * PostGIS path: listing ids within radius (meters). Returns null → caller uses Haversine fallback.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {number} radiusKm
 * @returns {Promise<string[] | null>}
 */
export async function fetchListingIdsWithinRadius(lat, lon, radiusKm) {
  const state = await getPostgisSpatialState()
  if (!state.postgisSpatialSearch) return null

  const { data, error } = await supabaseAdmin.rpc('listings_ids_within_radius_v1', {
    p_lat: lat,
    p_lng: lon,
    p_radius_m: radiusKm * 1000,
  })

  if (error) {
    console.warn('[spatial-filter] RPC listings_ids_within_radius_v1 failed:', error.message)
    return null
  }

  const ids = (data || [])
    .map((row) => (typeof row === 'string' ? row : row?.id))
    .filter(Boolean)
    .map(String)

  return ids.slice(0, MAX_SPATIAL_IDS)
}

/**
 * Legacy JS fallback when PostGIS column/RPC unavailable or RPC errors.
 *
 * @param {object[]} listings
 * @param {{ lat: number, lon: number, radiusKm: number }} spatial
 * @param {number} [limit]
 */
export function applyHaversineRadiusFilter(listings, spatial, limit) {
  const cap = Number.isFinite(limit) && limit > 0 ? limit : listings.length
  return listings
    .filter((listing) => {
      const lat = parseFloat(listing.latitude)
      const lon = parseFloat(listing.longitude)
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false
      return haversineKm(spatial.lat, spatial.lon, lat, lon) <= spatial.radiusKm
    })
    .slice(0, cap)
}

/**
 * @param {object[]} listings
 * @param {{ lat: number, lon: number, radiusKm: number }} spatial
 * @param {number} limit
 * @param {boolean} usedPostgisRadius
 */
export function finalizeRadiusFilteredListings(listings, spatial, limit, usedPostgisRadius) {
  if (!spatialRadiusActive(spatial)) return listings
  if (usedPostgisRadius) return listings.slice(0, limit)
  return applyHaversineRadiusFilter(listings, spatial, limit)
}
