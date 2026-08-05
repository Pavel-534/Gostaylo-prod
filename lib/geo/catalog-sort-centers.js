/**
 * Stage 167.0 / 200.37 — catalog "where" centers from geo_locations.centroid (no hardcoded hubs).
 */

import { resolveWhereSlugAlias } from '@/lib/locations/where-slug-aliases'
import {
  resolveWhereTarget,
  centroidFromWhereTarget,
} from '@/lib/locations/resolve-where-target'
import { GeoService } from '@/lib/services/geo/geo.service'

const WORLD_DEFAULT = Object.freeze({ lat: 20, lng: 100 })

/**
 * @param {{ south: number, north: number, west: number, east: number } | null | undefined} bounds
 * @returns {{ lat: number, lng: number } | null}
 */
export function bboxCenter(bounds) {
  if (!bounds || typeof bounds !== 'object') return null
  const { south, north, west, east } = bounds
  if (![south, north, west, east].every((n) => Number.isFinite(n))) return null
  return { lat: (south + north) / 2, lng: (west + east) / 2 }
}

/**
 * @param {string | null | undefined} where
 * @returns {Promise<{ lat: number, lng: number } | null>}
 */
export async function resolveWhereSortCenter(where) {
  if (!where || where === 'all') return null
  if (typeof where === 'object' && where !== null) {
    // personalization sometimes passed { where } by mistake
    return resolveWhereSortCenter(where.where)
  }
  const raw = String(where).trim()
  const aliased = resolveWhereSlugAlias(raw) || raw

  const target = await resolveWhereTarget(aliased)
  const fromTarget = centroidFromWhereTarget(target)
  if (fromTarget) return fromTarget

  const code = String(aliased).trim()
  const c = await GeoService.getCentroid(code)
  if (c) return { lat: c.lat, lng: c.lng }
  return null
}

/**
 * Sync fallback for callers that cannot await — world SEA default only (no Phuket invent).
 * Prefer resolveWhereSortCenter / resolveCatalogSortCenterAsync.
 */
export function resolveWhereSortCenterSync(_where) {
  return null
}

/**
 * @param {{ where?: string | null, bounds?: object | null, lat?: number | null, lng?: number | null }} input
 * @returns {Promise<{ lat: number, lng: number } | null>}
 */
export async function resolveCatalogSortCenter(input = {}) {
  const explicitLat = Number(input.lat)
  const explicitLng = Number(input.lng)
  if (Number.isFinite(explicitLat) && Number.isFinite(explicitLng)) {
    return { lat: explicitLat, lng: explicitLng }
  }
  const fromBounds = bboxCenter(input.bounds)
  if (fromBounds) return fromBounds
  return resolveWhereSortCenter(input.where)
}

export function getWorldDefaultCenter() {
  return { ...WORLD_DEFAULT }
}
