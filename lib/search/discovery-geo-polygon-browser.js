/**
 * Stage 177.5.1 — browser-only polygon encode (CompressionStream → gzip + base64url).
 * Never import Node zlib/crypto here.
 */

import {
  DISCOVERY_POLYGON_DEFAULT_MAX_AREA_KM2,
  DISCOVERY_POLYGON_MAX_PARAM_CHARS,
  validatePolygonGeoJson,
} from '@/lib/search/discovery-geo-polygon-core'

/**
 * @typedef {import('@/lib/search/discovery-geo-polygon-core').DiscoveryPolygonGeoJson} DiscoveryPolygonGeoJson
 */

function getClientMaxAreaKm2() {
  const raw = Number(
    typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_DISCOVERY_POLYGON_MAX_AREA_KM2
      : undefined,
  )
  if (Number.isFinite(raw) && raw > 0 && raw <= 5000) return raw
  return DISCOVERY_POLYGON_DEFAULT_MAX_AREA_KM2
}

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function bytesToBase64Url(bytes) {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  const b64 = btoa(binary)
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

/**
 * @param {DiscoveryPolygonGeoJson} geojson
 * @returns {Promise<string>}
 */
export async function encodePolygonSearchParamBrowser(geojson) {
  if (typeof CompressionStream === 'undefined') {
    throw new Error('CompressionStream is not available in this browser')
  }
  const json = JSON.stringify(geojson)
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))
  const buf = await new Response(stream).arrayBuffer()
  const encoded = bytesToBase64Url(new Uint8Array(buf))
  if (encoded.length > DISCOVERY_POLYGON_MAX_PARAM_CHARS) {
    throw new Error(`polygon param exceeds ${DISCOVERY_POLYGON_MAX_PARAM_CHARS} characters`)
  }
  return encoded
}

/**
 * Validate + encode for URL. Fail closed (no throw for validation).
 * @param {unknown} input
 * @returns {Promise<
 *   | { ok: true, geojson: DiscoveryPolygonGeoJson, encoded: string }
 *   | { ok: false, code: string, message: string }
 * >}
 */
export async function validateAndEncodePolygonForSearchUrl(input) {
  const validated = validatePolygonGeoJson(input, { maxAreaKm2: getClientMaxAreaKm2() })
  if (!validated.ok) return validated
  try {
    const encoded = await encodePolygonSearchParamBrowser(validated.geojson)
    return { ok: true, geojson: validated.geojson, encoded }
  } catch (err) {
    return {
      ok: false,
      code: 'POLYGON_ENCODE_FAILED',
      message: err?.message || 'Failed to encode polygon',
    }
  }
}
