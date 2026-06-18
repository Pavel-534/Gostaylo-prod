/**
 * Stage 164 — in-memory map-pins request telemetry (admin health).
 */

const MAX_SAMPLES = 200

/** @type {{ ms: number, mode: 'pins' | 'clusters', pinCount: number, clusterCount: number, bboxPinCount: number | null, approximateClusters: number }[]} */
let samples = []

/**
 * @param {object} params
 * @param {number} params.durationMs
 * @param {'pins' | 'clusters'} params.mode
 * @param {number} [params.pinCount]
 * @param {number} [params.clusterCount]
 * @param {number | null} [params.bboxPinCount]
 * @param {number} [params.approximateClusters]
 */
export function recordMapPinsMetrics({
  durationMs,
  mode,
  pinCount = 0,
  clusterCount = 0,
  bboxPinCount = null,
  approximateClusters = 0,
}) {
  samples.push({
    ms: Math.max(0, Number(durationMs) || 0),
    mode,
    pinCount: Number(pinCount) || 0,
    clusterCount: Number(clusterCount) || 0,
    bboxPinCount: bboxPinCount != null && Number.isFinite(Number(bboxPinCount)) ? Number(bboxPinCount) : null,
    approximateClusters: Number(approximateClusters) || 0,
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

export function getMapPinsMetricsSnapshot() {
  const msSorted = [...samples.map((s) => s.ms)].sort((a, b) => a - b)
  const total = samples.length
  const pinsMode = samples.filter((s) => s.mode === 'pins').length
  const clustersMode = samples.filter((s) => s.mode === 'clusters').length
  const clusterSamples = samples.filter((s) => s.mode === 'clusters')
  const clusterPrivacyOk = clusterSamples.filter(
    (s) => s.clusterCount > 0 && s.approximateClusters >= s.clusterCount,
  ).length

  return {
    sample_count: total,
    p50_ms: percentile(msSorted, 50),
    p95_ms: percentile(msSorted, 95),
    p99_ms: percentile(msSorted, 99),
    pins_request_ratio: total ? Number((pinsMode / total).toFixed(3)) : 0,
    clusters_request_ratio: total ? Number((clustersMode / total).toFixed(3)) : 0,
    cluster_privacy_ratio:
      clusterSamples.length > 0 ? Number((clusterPrivacyOk / clusterSamples.length).toFixed(3)) : 1,
    avg_pins_per_request:
      pinsMode > 0
        ? Number(
            (
              samples.filter((s) => s.mode === 'pins').reduce((a, s) => a + s.pinCount, 0) / pinsMode
            ).toFixed(1),
          )
        : 0,
    avg_clusters_per_request:
      clustersMode > 0
        ? Number(
            (
              samples.filter((s) => s.mode === 'clusters').reduce((a, s) => a + s.clusterCount, 0) /
              clustersMode
            ).toFixed(1),
          )
        : 0,
  }
}

/** @internal */
export function resetMapPinsMetricsForTests() {
  samples = []
}
