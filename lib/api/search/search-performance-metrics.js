/**
 * Stage 166 — in-memory search API latency telemetry (admin health).
 */

const MAX_SAMPLES = 300

/** @type {{ ms: number, spatial: boolean, cached: boolean }[]} */
let samples = []

/**
 * @param {object} params
 * @param {number} params.durationMs
 * @param {boolean} [params.spatial]
 * @param {boolean} [params.cached]
 */
export function recordSearchPerformanceMetrics({ durationMs, spatial = false, cached = false }) {
  samples.push({
    ms: Math.max(0, Number(durationMs) || 0),
    spatial: Boolean(spatial),
    cached: Boolean(cached),
  })
  if (samples.length > MAX_SAMPLES) {
    samples = samples.slice(-MAX_SAMPLES)
  }
}

function percentile(sorted, p) {
  if (!sorted.length) return 0
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

export function getSearchPerformanceMetricsSnapshot() {
  const msSorted = [...samples.map((s) => s.ms)].sort((a, b) => a - b)
  const total = samples.length
  const spatialSamples = samples.filter((s) => s.spatial)
  const spatialMs = [...spatialSamples.map((s) => s.ms)].sort((a, b) => a - b)
  const cached = samples.filter((s) => s.cached).length

  return {
    sample_count: total,
    p50_ms: percentile(msSorted, 50),
    p95_ms: percentile(msSorted, 95),
    p99_ms: percentile(msSorted, 99),
    spatial_sample_count: spatialSamples.length,
    spatial_p95_ms: percentile(spatialMs, 95),
    spatial_p99_ms: percentile(spatialMs, 99),
    cached_response_ratio: total ? Number((cached / total).toFixed(3)) : 0,
  }
}

/** @internal */
export function resetSearchPerformanceMetricsForTests() {
  samples = []
}
