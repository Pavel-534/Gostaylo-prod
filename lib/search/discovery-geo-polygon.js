/**
 * Stage 177.5.0/177.5.1 — Node GeoJSON polygon URL encode/decode (server-only).
 * Do NOT import from 'use client' components — use discovery-geo-polygon-browser.js.
 */

import { gunzipSync, gzipSync } from 'zlib'
import {
  DISCOVERY_POLYGON_DEFAULT_MAX_AREA_KM2,
  DISCOVERY_POLYGON_MAX_PARAM_CHARS,
  DISCOVERY_POLYGON_MAX_VERTICES,
  approxPolygonRingAreaKm2,
  polygonGeoJsonCacheFingerprint,
  polygonGeoJsonToBbox,
  validatePolygonGeoJson,
} from '@/lib/search/discovery-geo-polygon-core'

export {
  DISCOVERY_POLYGON_DEFAULT_MAX_AREA_KM2,
  DISCOVERY_POLYGON_MAX_PARAM_CHARS,
  DISCOVERY_POLYGON_MAX_VERTICES,
  approxPolygonRingAreaKm2,
  polygonGeoJsonCacheFingerprint,
  polygonGeoJsonToBbox,
  validatePolygonGeoJson,
}

/**
 * @typedef {import('@/lib/search/discovery-geo-polygon-core').DiscoveryPolygonGeoJson} DiscoveryPolygonGeoJson
 */

/**
 * @returns {number}
 */
export function getDiscoveryPolygonMaxAreaKm2() {
  const raw = Number(process.env.DISCOVERY_POLYGON_MAX_AREA_KM2)
  if (Number.isFinite(raw) && raw > 0 && raw <= 5000) return raw
  return DISCOVERY_POLYGON_DEFAULT_MAX_AREA_KM2
}

/**
 * @param {DiscoveryPolygonGeoJson} geojson
 * @returns {string} base64url(gzip(JSON))
 */
export function encodePolygonSearchParam(geojson) {
  const json = JSON.stringify(geojson)
  return gzipSync(Buffer.from(json, 'utf8')).toString('base64url')
}

/**
 * @param {string} raw
 * @returns {{ ok: true, geojson: DiscoveryPolygonGeoJson } | { ok: false, code: string, message: string }}
 */
export function decodePolygonSearchParam(raw) {
  const trimmed = String(raw || '').trim()
  if (!trimmed) {
    return { ok: false, code: 'POLYGON_EMPTY', message: 'polygon param is empty' }
  }
  if (trimmed.length > DISCOVERY_POLYGON_MAX_PARAM_CHARS) {
    return {
      ok: false,
      code: 'POLYGON_TOO_LARGE',
      message: `polygon param exceeds ${DISCOVERY_POLYGON_MAX_PARAM_CHARS} characters`,
    }
  }

  /** @type {unknown} */
  let parsed
  if (trimmed.startsWith('{')) {
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      return { ok: false, code: 'POLYGON_JSON_INVALID', message: 'polygon JSON parse failed' }
    }
  } else {
    try {
      const buf = Buffer.from(trimmed, 'base64url')
      const json = gunzipSync(buf).toString('utf8')
      parsed = JSON.parse(json)
    } catch {
      return {
        ok: false,
        code: 'POLYGON_DECODE_INVALID',
        message: 'polygon must be gzip+base64url GeoJSON (or compact JSON for tests)',
      }
    }
  }

  return validatePolygonGeoJson(parsed, { maxAreaKm2: getDiscoveryPolygonMaxAreaKm2() })
}
