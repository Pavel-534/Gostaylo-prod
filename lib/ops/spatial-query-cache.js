/**
 * Stage 166 — in-process TTL cache for hot spatial RPC results (bbox / radius).
 * Production scale-out: replace with Redis/Vercel KV (same key shape).
 */

const DEFAULT_TTL_MS = 8 * 1000
const MAX_ENTRIES = 400

/** @type {Map<string, { value: unknown, expiresAt: number }>} */
const store = new Map()

/**
 * @param {number} n
 * @param {number} [decimals]
 */
function roundCoord(n, decimals = 3) {
  const f = 10 ** decimals
  return Math.round(Number(n) * f) / f
}

/**
 * @param {{ south: number, west: number, north: number, east: number }} bbox
 */
export function spatialBboxCacheKey(bbox, suffix = '') {
  return `bbox:${roundCoord(bbox.south)}:${roundCoord(bbox.west)}:${roundCoord(bbox.north)}:${roundCoord(bbox.east)}${suffix ? `:${suffix}` : ''}`
}

/**
 * @param {number} lat
 * @param {number} lng
 * @param {number} radiusKm
 */
export function spatialRadiusCacheKey(lat, lng, radiusKm, suffix = '') {
  return `radius:${roundCoord(lat)}:${roundCoord(lng)}:${roundCoord(radiusKm, 2)}${suffix ? `:${suffix}` : ''}`
}

/**
 * @param {string} key
 */
export function getSpatialCache(key) {
  const row = store.get(key)
  if (!row) return { hit: false, value: null }
  if (row.expiresAt < Date.now()) {
    store.delete(key)
    return { hit: false, value: null }
  }
  return { hit: true, value: row.value }
}

/**
 * @param {string} key
 * @param {unknown} value
 * @param {number} [ttlMs]
 */
export function setSpatialCache(key, value, ttlMs = DEFAULT_TTL_MS) {
  if (store.size >= MAX_ENTRIES) {
    const first = store.keys().next().value
    if (first) store.delete(first)
  }
  store.set(key, { value, expiresAt: Date.now() + ttlMs })
}

let hits = 0
let misses = 0

export function recordSpatialCacheHit() {
  hits += 1
}

export function recordSpatialCacheMiss() {
  misses += 1
}

export function getSpatialCacheMetrics() {
  const total = hits + misses
  return {
    hits,
    misses,
    hit_ratio: total ? Number((hits / total).toFixed(3)) : 0,
    entries: store.size,
    max_entries: MAX_ENTRIES,
    ttl_ms: DEFAULT_TTL_MS,
  }
}

/** @internal */
export function resetSpatialCacheForTests() {
  store.clear()
  hits = 0
  misses = 0
}
