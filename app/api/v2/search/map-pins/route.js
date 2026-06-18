/**
 * Stage 163.0 — lean map pins for catalog map (no full listing payload).
 * GET /api/v2/search/map-pins
 *
 * Query: same as catalog search (south/north/west/east, dates, price, category, where…).
 * Requires viewport bbox OR lat/lng/radius.
 *
 * Response modes:
 * - pins: { id, lat, lng, price, status [, distance_from_center_km] }
 * - clusters: server PostGIS grid when bbox count > 200 (or cluster=1); centroid = grid cell center (163.3)
 */
export const dynamic = 'force-dynamic'

import { runMapPinsGet } from '@/lib/api/run-map-pins-get'

export async function GET(request) {
  return runMapPinsGet(request)
}
