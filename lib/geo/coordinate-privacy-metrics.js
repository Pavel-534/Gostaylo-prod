/**
 * Stage 164 — coordinate privacy serialization telemetry (fuzz vs reveal).
 */

const MAX_SAMPLES = 500

/** @type {{ revealLevel: string, policyMode: string, fuzzApplied: boolean }[]} */
let samples = []

/**
 * @param {object} params
 * @param {string} params.revealLevel
 * @param {string} params.policyMode
 * @param {boolean} params.fuzzApplied
 */
export function recordCoordinatePrivacyMetrics({ revealLevel, policyMode, fuzzApplied }) {
  samples.push({
    revealLevel: String(revealLevel || 'public_fuzz'),
    policyMode: String(policyMode || 'fuzz'),
    fuzzApplied: Boolean(fuzzApplied),
  })
  if (samples.length > MAX_SAMPLES) {
    samples = samples.slice(-MAX_SAMPLES)
  }
}

export function getCoordinatePrivacyMetricsSnapshot() {
  const total = samples.length
  const fuzzApplied = samples.filter((s) => s.fuzzApplied).length
  const exactReveal = samples.filter((s) => s.revealLevel === 'exact').length
  const exactPolicy = samples.filter((s) => s.policyMode === 'exact').length

  return {
    sample_count: total,
    fuzz_ratio: total ? Number((fuzzApplied / total).toFixed(3)) : 0,
    reveal_rate: total ? Number((exactReveal / total).toFixed(3)) : 0,
    exact_policy_ratio: total ? Number((exactPolicy / total).toFixed(3)) : 0,
  }
}

/** @internal */
export function resetCoordinatePrivacyMetricsForTests() {
  samples = []
}
