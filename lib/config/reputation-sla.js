/**
 * Stage 17.0 — SLA / response speed in reliability score and TOP gate.
 * Search ranking knobs: lib/config/reputation-ranking.js
 */

/** Min completed samples in rolling window before SLA affects the 0–100 score */
export const REPUTATION_SLA_MIN_SAMPLES_SCORE = 3

/** Min samples before TOP tier is blocked by slow response (avg ≥ threshold minutes) */
export const REPUTATION_SLA_MIN_SAMPLES_TOP_GATE = 3

/** Bonus to raw score when rolling avg first response ≤ this many minutes */
export const REPUTATION_SLA_BONUS_AVG_MAX_MINUTES = 30
export const REPUTATION_SLA_BONUS_POINTS = 3

/** Penalty when avg first response > this many minutes (4h) */
export const REPUTATION_SLA_PENALTY_AVG_MIN_MINUTES = 240
export const REPUTATION_SLA_PENALTY_POINTS = 5

/** TOP tier: rolling avg must stay below this (minutes) when sample gate is met */
export const REPUTATION_SLA_TOP_MAX_AVG_MINUTES = 60
