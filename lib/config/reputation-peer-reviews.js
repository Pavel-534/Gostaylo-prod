/**
 * Stage 18–19 — guest→partner listing reviews (`reviews`) influence + TOP floor.
 * Partner→guest (`guest_reviews`) is tracked separately for transparency, not mixed into host %.
 */

/** Minimum completed stays before peer stars nudge the host reliability score */
export const REPUTATION_PEER_ADJUST_MIN_COMPLETED_STAYS = 1

/** Minimum guest reviews before avg affects score / TOP floor */
export const REPUTATION_PEER_MIN_REVIEW_COUNT = 5

/** Average (1–5) at or above → small bonus */
export const REPUTATION_PEER_STRONG_AVG_STARS = 4.5
export const REPUTATION_PEER_BONUS_POINTS = 2

/** Average at or below → penalty */
export const REPUTATION_PEER_WEAK_AVG_STARS = 3.0
export const REPUTATION_PEER_PENALTY_POINTS = 4

/** Stage 19.0 — TOP impossible below this average when review count gate is met */
export const REPUTATION_PEER_TOP_MIN_AVG_STARS = 4.2
export const REPUTATION_PEER_TOP_MIN_REVIEW_COUNT = 5
