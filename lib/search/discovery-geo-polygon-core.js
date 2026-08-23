/**
 * Stage 177.5.1 — pure GeoJSON polygon helpers (no Node zlib/crypto).
 * Safe for browser + server. Coordinates: RFC 7946 [lng, lat].
 */

export const DISCOVERY_POLYGON_MAX_VERTICES = 500
/** Encoded `polygon=` max length — keeps Vercel/proxy query strings cheap. */
export const DISCOVERY_POLYGON_MAX_PARAM_CHARS = 4096
/** Soft product cap when env unset. */
export const DISCOVERY_POLYGON_DEFAULT_MAX_AREA_KM2 = 50

/**
 * @typedef {{ type: 'Polygon', coordinates: number[][][] }} DiscoveryPolygonGeoJson
 */

/**
 * @param {number[][]} ring [lng,lat] closed
 * @returns {number}
 */
export function approxPolygonRingAreaKm2(ring) {
  if (!Array.isArray(ring) || ring.length < 4) return 0
  let sum = 0
  let latSum = 0
  const n = ring.length - 1
  for (let i = 0; i < n; i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[i + 1]
    sum += x1 * y2 - x2 * y1
    latSum += y1
  }
  const deg2 = Math.abs(sum) / 2
  const midLat = latSum / n
  const kmPerDegLat = 111.32
  const kmPerDegLng = 111.32 * Math.cos((midLat * Math.PI) / 180)
  return deg2 * kmPerDegLat * kmPerDegLng
}

/**
 * Non-crypto fingerprint for cache / parity keys (browser-safe).
 * @param {DiscoveryPolygonGeoJson} geojson
 * @returns {string}
 */
export function polygonGeoJsonCacheFingerprint(geojson) {
  const json = JSON.stringify(geojson)
  let h = 2166136261
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `${(h >>> 0).toString(16).padStart(8, '0')}${json.length.toString(16)}`
}

/**
 * @param {unknown} input
 * @param {{ maxAreaKm2?: number }} [options]
 * @returns {{ ok: true, geojson: DiscoveryPolygonGeoJson } | { ok: false, code: string, message: string }}
 */
export function validatePolygonGeoJson(input, options = {}) {
  const maxArea =
    Number.isFinite(options.maxAreaKm2) && options.maxAreaKm2 > 0
      ? options.maxAreaKm2
      : DISCOVERY_POLYGON_DEFAULT_MAX_AREA_KM2

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, code: 'POLYGON_TYPE_INVALID', message: 'GeoJSON must be an object' }
  }

  const type = /** @type {{ type?: string }} */ (input).type
  if (type !== 'Polygon') {
    return { ok: false, code: 'POLYGON_TYPE_INVALID', message: 'Only GeoJSON type Polygon is supported' }
  }

  const coordinates = /** @type {{ coordinates?: unknown }} */ (input).coordinates
  if (!Array.isArray(coordinates) || coordinates.length < 1) {
    return {
      ok: false,
      code: 'POLYGON_RING_INVALID',
      message: 'Polygon.coordinates must be a non-empty ring array',
    }
  }
  if (coordinates.length > 1) {
    return {
      ok: false,
      code: 'POLYGON_HOLES_UNSUPPORTED',
      message: 'Inner rings (holes) are not supported',
    }
  }

  const ring = coordinates[0]
  if (!Array.isArray(ring) || ring.length < 3) {
    return {
      ok: false,
      code: 'POLYGON_RING_INVALID',
      message: 'Outer ring needs at least 3 positions',
    }
  }

  /** @type {number[][]} */
  const normalized = []
  for (let i = 0; i < ring.length; i++) {
    const pt = ring[i]
    if (!Array.isArray(pt) || pt.length < 2) {
      return { ok: false, code: 'POLYGON_COORD_INVALID', message: 'Each position must be [lng, lat]' }
    }
    const lng = Number(pt[0])
    const lat = Number(pt[1])
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return { ok: false, code: 'POLYGON_COORD_INVALID', message: 'Coordinates must be finite numbers' }
    }
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return { ok: false, code: 'POLYGON_COORD_OUT_OF_RANGE', message: 'lng/lat out of WGS84 range' }
    }
    normalized.push([lng, lat])
  }

  const first = normalized[0]
  const last = normalized[normalized.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) {
    normalized.push([first[0], first[1]])
  }

  if (normalized.length > DISCOVERY_POLYGON_MAX_VERTICES) {
    return {
      ok: false,
      code: 'POLYGON_TOO_MANY_VERTICES',
      message: `Polygon exceeds ${DISCOVERY_POLYGON_MAX_VERTICES} vertices`,
    }
  }
  if (normalized.length < 4) {
    return {
      ok: false,
      code: 'POLYGON_RING_INVALID',
      message: 'Closed outer ring needs at least 4 positions',
    }
  }

  for (let i = 0; i < normalized.length - 1; i++) {
    if (Math.abs(normalized[i][0] - normalized[i + 1][0]) > 180) {
      return {
        ok: false,
        code: 'POLYGON_ANTIMERIDIAN',
        message: 'Polygons crossing the antimeridian are not supported',
      }
    }
  }

  const areaKm2 = approxPolygonRingAreaKm2(normalized)
  if (!(areaKm2 > 0) || areaKm2 > maxArea) {
    return {
      ok: false,
      code: 'POLYGON_AREA_INVALID',
      message: `Polygon area must be between 0 and ${maxArea} km²`,
    }
  }

  return {
    ok: true,
    geojson: {
      type: 'Polygon',
      coordinates: [normalized],
    },
  }
}

/**
 * Envelope for map camera (not used as search bbox when polygon is active).
 * @param {DiscoveryPolygonGeoJson} geojson
 * @returns {{ south: number, north: number, west: number, east: number } | null}
 */
export function polygonGeoJsonToBbox(geojson) {
  const ring = geojson?.coordinates?.[0]
  if (!Array.isArray(ring) || ring.length < 4) return null
  let south = Infinity
  let north = -Infinity
  let west = Infinity
  let east = -Infinity
  for (const pt of ring) {
    const lng = Number(pt[0])
    const lat = Number(pt[1])
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
    south = Math.min(south, lat)
    north = Math.max(north, lat)
    west = Math.min(west, lng)
    east = Math.max(east, lng)
  }
  if (![south, north, west, east].every((n) => Number.isFinite(n))) return null
  if (!(south < north) || !(west < east)) return null
  return { south, north, west, east }
}
