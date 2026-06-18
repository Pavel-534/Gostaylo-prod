/**
 * Stage 166 — performance telemetry for admin health (search + map + cache).
 */

import { getSearchPerformanceMetricsSnapshot } from '@/lib/api/search/search-performance-metrics'
import { getMapPinsMetricsSnapshot } from '@/lib/geo/map-pins-metrics'
import { getSpatialCacheMetrics } from '@/lib/ops/spatial-query-cache'
import { getSpatialCircuitSnapshot } from '@/lib/ops/spatial-circuit-breaker'

export function loadPerformanceStatsHealth() {
  const search = getSearchPerformanceMetricsSnapshot()
  const mapPins = getMapPinsMetricsSnapshot()
  const spatialCache = getSpatialCacheMetrics()
  const spatialCircuit = getSpatialCircuitSnapshot()

  return {
    search,
    mapPins,
    spatialCache,
    spatialCircuit,
    rateLimits: {
      spatial_map_per_min: 45,
      spatial_catalog_per_min: 45,
      spatial_catalog_user_per_min: 90,
      search_per_min: 60,
    },
    dbConnections: {
      source: 'supabase_pooler',
      note: 'In-process metrics only; pool usage — Supabase dashboard / logs',
    },
  }
}
