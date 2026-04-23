/**
 * Stage 16.0 — reputation influence on catalog/search ordering.
 * Boost is additive on the base rank (newer DB order wins ties); featured still dominates via large constant.
 */

/** @type {Record<string, number>} */
export const REPUTATION_SEARCH_POSITION_BOOST_BY_TIER = {
  TOP: 36,
  STRONG: 16,
  STANDARD: 4,
  NEW: 0,
  DEFAULT: 0,
}

/** Multiplier applied to the non-featured rank component (optional fine-tune). */
export const REPUTATION_SEARCH_TIER_MULTIPLIER = {
  TOP: 1.12,
  STRONG: 1.06,
  STANDARD: 1.0,
  NEW: 1.0,
  DEFAULT: 1.0,
}

/** Featured listings always sort before non-featured when using combined score. */
export const REPUTATION_SEARCH_FEATURED_WEIGHT = 1_000_000

/**
 * Stage 17.0 — additive search adjustment from 30d avg initial response (minutes).
 * Requires ≥ `SLA_RESPONSE_RANKING_MIN_SAMPLES` samples; null / thin data → 0.
 */
export const SLA_RESPONSE_RANKING_MIN_SAMPLES = 3
export const SLA_RESPONSE_RANKING_FAST_MINS = 30
export const SLA_RESPONSE_RANKING_SLOW_MINS = 240
/** Max positive boost (at avg ≤ FAST). */
export const SLA_RESPONSE_BOOST = 18
/** Negative boost magnitude at avg ≥ SLOW (subtracted from score line). */
export const SLA_RESPONSE_RANKING_PENALTY = 10

/**
 * @param {number | null | undefined} avgMinutes
 * @param {number} sampleCount
 * @returns {number}
 */
export function computeSlaSearchBoost(avgMinutes, sampleCount) {
  if (sampleCount < SLA_RESPONSE_RANKING_MIN_SAMPLES) return 0
  if (avgMinutes == null || !Number.isFinite(avgMinutes)) return 0
  if (avgMinutes <= SLA_RESPONSE_RANKING_FAST_MINS) return SLA_RESPONSE_BOOST
  if (avgMinutes >= SLA_RESPONSE_RANKING_SLOW_MINS) return -SLA_RESPONSE_RANKING_PENALTY
  const span = SLA_RESPONSE_RANKING_SLOW_MINS - SLA_RESPONSE_RANKING_FAST_MINS
  if (span <= 0) return 0
  const t = (avgMinutes - SLA_RESPONSE_RANKING_FAST_MINS) / span
  return SLA_RESPONSE_BOOST * (1 - t) + t * (-SLA_RESPONSE_RANKING_PENALTY)
}
