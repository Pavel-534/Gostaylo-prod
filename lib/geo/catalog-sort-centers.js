/**
 * Stage 167.0 — known catalog "where" centers for distance sort (no geolocation prompt).
 * Keys: city slugs from country-presets / where UI.
 */

import { resolveWhereSlugAlias } from '@/lib/locations/where-slug-aliases'

/** @type {Record<string, { lat: number, lng: number }>} */
const WHERE_SORT_CENTERS = {
  'phuket-city': { lat: 7.8804, lng: 98.3923 },
  phuket: { lat: 7.8804, lng: 98.3923 },
  pattaya: { lat: 12.9236, lng: 100.8825 },
  bangkok: { lat: 13.7563, lng: 100.5018 },
  samui: { lat: 9.512, lng: 100.0136 },
  'krabi-city': { lat: 8.0863, lng: 98.9063 },
  krabi: { lat: 8.0863, lng: 98.9063 },
  moscow: { lat: 55.7558, lng: 37.6173 },
  'moscow-city': { lat: 55.7558, lng: 37.6173 },
  spb: { lat: 59.9343, lng: 30.3351 },
  'saint-petersburg': { lat: 59.9343, lng: 30.3351 },
  sochi: { lat: 43.6028, lng: 39.7342 },
  kazan: { lat: 55.8304, lng: 49.0661 },
  denpasar: { lat: -8.6705, lng: 115.2126 },
  dubai: { lat: 25.2048, lng: 55.2708 },
}

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
 * @returns {{ lat: number, lng: number } | null}
 */
export function resolveWhereSortCenter(where) {
  if (!where || where === 'all') return null
  const raw = String(where).trim().toLowerCase()
  const aliased = resolveWhereSlugAlias(raw) || raw
  const key = String(aliased).trim().toLowerCase()
  return WHERE_SORT_CENTERS[key] ?? null
}

/**
 * @param {{ where?: string | null, bounds?: object | null, lat?: number | null, lng?: number | null }} input
 * @returns {{ lat: number, lng: number } | null}
 */
export function resolveCatalogSortCenter(input = {}) {
  const explicitLat = Number(input.lat)
  const explicitLng = Number(input.lng)
  if (Number.isFinite(explicitLat) && Number.isFinite(explicitLng)) {
    return { lat: explicitLat, lng: explicitLng }
  }
  const fromBounds = bboxCenter(input.bounds)
  if (fromBounds) return fromBounds
  return resolveWhereSortCenter(input.where)
}
