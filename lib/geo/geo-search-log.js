/**
 * Stage 165 — structured geo map search logging (grep-friendly).
 */

import { logStructured } from '@/lib/critical-telemetry.js'

/**
 * @param {object} params
 * @param {{ south: number, west: number, north: number, east: number } | [number, number, number, number] | null} [params.bbox]
 * @param {'pins' | 'clusters'} params.mode
 * @param {number} [params.clustersReturned]
 * @param {number} [params.pinsReturned]
 * @param {number} params.latencyMs
 * @param {number | null} [params.bboxPinCount]
 */
export function logGeoMapSearch({
  bbox = null,
  mode,
  clustersReturned = 0,
  pinsReturned = 0,
  latencyMs,
  bboxPinCount = null,
}) {
  const bboxArr = Array.isArray(bbox)
    ? bbox
    : bbox
      ? [bbox.south, bbox.west, bbox.north, bbox.east]
      : null

  logStructured({
    module: 'GEO_SEARCH',
    stage: 'map_pins',
    bbox: bboxArr,
    mode,
    clusters_returned: clustersReturned,
    pins_returned: pinsReturned,
    bbox_pin_count: bboxPinCount,
    latency_ms: latencyMs,
  })

  console.log(
    `[GEO_SEARCH] bbox: ${bboxArr ? JSON.stringify(bboxArr) : 'null'}, clusters_returned: ${clustersReturned}, pins_returned: ${pinsReturned}, latency: ${latencyMs}ms`,
  )
}
