/**
 * Map viewport bbox quantization — aligns client TanStack keys with server
 * `spatial-query-cache` (`roundCoord` 3 decimals ≈ 111 m).
 */

export const MAP_BBOX_QUANTIZE_DECIMALS = 3

/**
 * @param {number} n
 * @param {number} [decimals]
 * @returns {number}
 */
export function roundMapCoord(n, decimals = MAP_BBOX_QUANTIZE_DECIMALS) {
  const f = 10 ** decimals
  return Math.round(Number(n) * f) / f
}

/**
 * @param {{ south: number, north: number, west: number, east: number } | null | undefined} bbox
 * @returns {{ south: number, north: number, west: number, east: number } | null}
 */
export function quantizeMapBbox(bbox) {
  if (!bbox || typeof bbox !== 'object') return null
  const { south, north, west, east } = bbox
  if (![south, north, west, east].every((n) => typeof n === 'number' && Number.isFinite(n))) {
    return null
  }
  if (south >= north || west >= east) return null

  return {
    south: roundMapCoord(south),
    north: roundMapCoord(north),
    west: roundMapCoord(west),
    east: roundMapCoord(east),
  }
}
