/**
 * Stage 160 — lightweight in-memory suggest telemetry (non-blocking).
 */

const MAX_SAMPLES = 200

/** @type {{ ms: number, match_kind: string | null }[]} */
let samples = []

/**
 * @param {number} ms
 * @param {import('@/lib/locations/location-suggest.service.js').LocationSuggestItem[]} [items]
 */
export function recordLocationSuggestMetrics(ms, items = []) {
  const top = items[0]
  samples.push({ ms, match_kind: top?.match_kind ?? null })
  if (samples.length > MAX_SAMPLES) {
    samples = samples.slice(-MAX_SAMPLES)
  }
}

function percentile(sorted, p) {
  if (!sorted.length) return 0
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

export function getLocationSuggestMetricsSnapshot() {
  const msSorted = [...samples.map((s) => s.ms)].sort((a, b) => a - b)
  const total = samples.length
  const synonym = samples.filter((s) => s.match_kind === 'synonym').length
  const unverified = samples.filter((s) => s.match_kind === 'unverified').length
  const fuzzy = samples.filter((s) => s.match_kind === 'fuzzy').length

  return {
    sample_count: total,
    p50_ms: percentile(msSorted, 50),
    p95_ms: percentile(msSorted, 95),
    synonym_hit_rate: total ? Number((synonym / total).toFixed(3)) : 0,
    unverified_hit_rate: total ? Number((unverified / total).toFixed(3)) : 0,
    fuzzy_hit_rate: total ? Number((fuzzy / total).toFixed(3)) : 0,
  }
}

/** @internal */
export function resetLocationSuggestMetricsForTests() {
  samples = []
}
