import {
  REPUTATION_SLA_MIN_SAMPLES_SCORE,
  REPUTATION_SLA_MIN_SAMPLES_TOP_GATE,
  REPUTATION_SLA_BONUS_AVG_MAX_MINUTES,
  REPUTATION_SLA_BONUS_POINTS,
  REPUTATION_SLA_PENALTY_AVG_MIN_MINUTES,
  REPUTATION_SLA_PENALTY_POINTS,
  REPUTATION_SLA_TOP_MAX_AVG_MINUTES,
} from '@/lib/config/reputation-sla'
import {
  REPUTATION_PEER_ADJUST_MIN_COMPLETED_STAYS,
  REPUTATION_PEER_MIN_REVIEW_COUNT,
  REPUTATION_PEER_STRONG_AVG_STARS,
  REPUTATION_PEER_BONUS_POINTS,
  REPUTATION_PEER_WEAK_AVG_STARS,
  REPUTATION_PEER_PENALTY_POINTS,
  REPUTATION_PEER_TOP_MIN_AVG_STARS,
  REPUTATION_PEER_TOP_MIN_REVIEW_COUNT,
} from '@/lib/config/reputation-peer-reviews'
import { clamp } from './constants.js'

/**
 * Canonical aggregate for guest→partner star ratings (1–5 scale).
 * @param {Array<number | string | null | undefined>} ratings
 * @returns {{ total: number, averageRating: number }}
 */
export function summarizeGuestReviewRatings(ratings) {
  const arr = (ratings || [])
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 5)
  if (!arr.length) return { total: 0, averageRating: 0 }
  const sum = arr.reduce((a, b) => a + b, 0)
  return { total: arr.length, averageRating: Math.round((sum / arr.length) * 10) / 10 }
}

/**
 * @param {object} p
 * @param {number} p.completedTotal
 * @param {number} p.weightedDisputedUnits
 * @param {number} p.penaltyPointsSumWeighted
 * @param {number} p.penaltyCountWeighted
 * @param {number} p.partnerDeclinedWeighted
 * @param {number} p.partnerCancelWeighted
 * @param {number | null} [p.slaAvgInitialResponseMinutes30d]
 * @param {number} [p.slaInitialResponseSampleCount30d]
 * @param {number | null} [p.guestReviewAvgStars]
 * @param {number} [p.guestReviewCount]
 * @returns {{ reliabilityPercent: number | null, tier: string, cleanCompleted: number, topBlockedByGuestReviews: boolean }}
 */
export function computeReliabilityFromCounts({
  completedTotal,
  weightedDisputedUnits,
  penaltyPointsSumWeighted,
  penaltyCountWeighted,
  partnerDeclinedWeighted,
  partnerCancelWeighted,
  slaAvgInitialResponseMinutes30d = null,
  slaInitialResponseSampleCount30d = 0,
  guestReviewAvgStars = null,
  guestReviewCount = 0,
}) {
  const cleanCompleted = Math.max(0, completedTotal - weightedDisputedUnits)
  const disputeRate = completedTotal > 0 ? weightedDisputedUnits / completedTotal : 0

  const hasSignal =
    completedTotal > 0 ||
    penaltyPointsSumWeighted > 0 ||
    penaltyCountWeighted > 0 ||
    partnerDeclinedWeighted > 0 ||
    partnerCancelWeighted > 0

  if (!hasSignal) {
    return { reliabilityPercent: null, tier: 'NEW', cleanCompleted: 0, topBlockedByGuestReviews: false }
  }

  let score = 100
  score -= Math.round(disputeRate * 38)
  score -= Math.min(30, penaltyPointsSumWeighted * 4 + penaltyCountWeighted * 2)
  score -= Math.min(12, partnerDeclinedWeighted * 3)
  score -= Math.min(15, partnerCancelWeighted * 5)
  score += Math.min(8, Math.floor(cleanCompleted / 5))

  const slaN = Number(slaInitialResponseSampleCount30d) || 0
  const slaAvg = slaAvgInitialResponseMinutes30d
  if (
    slaN >= REPUTATION_SLA_MIN_SAMPLES_SCORE &&
    slaAvg != null &&
    Number.isFinite(slaAvg)
  ) {
    if (slaAvg <= REPUTATION_SLA_BONUS_AVG_MAX_MINUTES) score += REPUTATION_SLA_BONUS_POINTS
    if (slaAvg > REPUTATION_SLA_PENALTY_AVG_MIN_MINUTES) score -= REPUTATION_SLA_PENALTY_POINTS
  }

  const gN = Number(guestReviewCount) || 0
  const gAvg = guestReviewAvgStars
  if (
    completedTotal >= REPUTATION_PEER_ADJUST_MIN_COMPLETED_STAYS &&
    gN >= REPUTATION_PEER_MIN_REVIEW_COUNT &&
    gAvg != null &&
    Number.isFinite(gAvg)
  ) {
    if (gAvg >= REPUTATION_PEER_STRONG_AVG_STARS) score += REPUTATION_PEER_BONUS_POINTS
    if (gAvg <= REPUTATION_PEER_WEAK_AVG_STARS) score -= REPUTATION_PEER_PENALTY_POINTS
  }

  const reliabilityPercent = clamp(Math.round(score), 48, 100)

  const slaBlocksTop =
    slaN >= REPUTATION_SLA_MIN_SAMPLES_TOP_GATE &&
    slaAvg != null &&
    Number.isFinite(slaAvg) &&
    slaAvg >= REPUTATION_SLA_TOP_MAX_AVG_MINUTES

  let tier = 'STANDARD'
  if (
    reliabilityPercent >= 96 &&
    cleanCompleted >= 8 &&
    penaltyPointsSumWeighted <= 2 &&
    weightedDisputedUnits <= 1.05 &&
    !slaBlocksTop
  ) {
    tier = 'TOP'
  } else if (reliabilityPercent >= 88) {
    tier = 'STRONG'
  }

  let topBlockedByGuestReviews = false
  const guestBlocksTop =
    gN >= REPUTATION_PEER_TOP_MIN_REVIEW_COUNT &&
    gAvg != null &&
    Number.isFinite(gAvg) &&
    gAvg < REPUTATION_PEER_TOP_MIN_AVG_STARS

  if (tier === 'TOP' && guestBlocksTop) {
    tier = 'STANDARD'
    topBlockedByGuestReviews = true
  }

  return { reliabilityPercent, tier, cleanCompleted, topBlockedByGuestReviews }
}

export function buildCriticalFactors(snap) {
  const {
    completedTotal,
    weightedDisputedUnits,
    penaltyPointsSumWeighted,
    penaltyCountWeighted,
    partnerDeclinedWeighted,
    partnerCancelWeighted,
  } = snap
  const out = []
  const disputeDed = completedTotal > 0 ? Math.round((weightedDisputedUnits / completedTotal) * 38) : 0
  if (disputeDed > 0) out.push({ key: 'disputes', impact: disputeDed })
  const penDed = Math.min(30, penaltyPointsSumWeighted * 4 + penaltyCountWeighted * 2)
  if (penDed > 0) out.push({ key: 'penalties', impact: Math.round(penDed) })
  const decDed = Math.min(12, partnerDeclinedWeighted * 3)
  if (decDed > 0) out.push({ key: 'declines', impact: Math.round(decDed) })
  const canDed = Math.min(15, partnerCancelWeighted * 5)
  if (canDed > 0) out.push({ key: 'cancellations', impact: Math.round(canDed) })
  const slaN = Number(snap.initialResponseSampleCount30d) || 0
  const slaAvg = snap.avgInitialResponseMinutes30d
  if (
    slaN >= REPUTATION_SLA_MIN_SAMPLES_SCORE &&
    slaAvg != null &&
    Number.isFinite(slaAvg) &&
    slaAvg > REPUTATION_SLA_PENALTY_AVG_MIN_MINUTES
  ) {
    out.push({ key: 'response_speed', impact: REPUTATION_SLA_PENALTY_POINTS })
  }
  const gN = Number(snap.guestReviewCount) || 0
  const gAvg = snap.guestReviewAvgStars
  if (
    completedTotal >= REPUTATION_PEER_ADJUST_MIN_COMPLETED_STAYS &&
    gN >= REPUTATION_PEER_MIN_REVIEW_COUNT &&
    gAvg != null &&
    Number.isFinite(gAvg) &&
    gAvg <= REPUTATION_PEER_WEAK_AVG_STARS
  ) {
    out.push({ key: 'guest_reviews_low', impact: REPUTATION_PEER_PENALTY_POINTS })
  }
  if (snap.topBlockedByGuestReviews) {
    out.push({ key: 'guest_reviews_top_floor', impact: 50 })
  }
  return out.sort((a, b) => b.impact - a.impact).slice(0, 5)
}

export function buildPathToTop(snap) {
  const needClean = Math.max(0, 8 - Math.floor(Number(snap.cleanCompleted) || 0))
  const needScore =
    snap.reliabilityPercent != null && Number.isFinite(snap.reliabilityPercent)
      ? Math.max(0, 96 - snap.reliabilityPercent)
      : null
  const disputeOk = snap.weightedDisputedUnits <= 1.05
  const penaltyOk = snap.penaltyPointsSumWeighted <= 2
  const slaN = Number(snap.initialResponseSampleCount30d) || 0
  const slaAvg = snap.avgInitialResponseMinutes30d
  const slaTopOk = !(
    slaN >= REPUTATION_SLA_MIN_SAMPLES_TOP_GATE &&
    slaAvg != null &&
    Number.isFinite(slaAvg) &&
    slaAvg >= REPUTATION_SLA_TOP_MAX_AVG_MINUTES
  )
  const gN = Number(snap.guestReviewCount) || 0
  const gAvg = snap.guestReviewAvgStars
  const guestReviewsTopOk = !(
    snap.completedTotal >= REPUTATION_PEER_ADJUST_MIN_COMPLETED_STAYS &&
    gN >= REPUTATION_PEER_MIN_REVIEW_COUNT &&
    gAvg != null &&
    Number.isFinite(gAvg) &&
    gAvg <= REPUTATION_PEER_WEAK_AVG_STARS
  )
  const guestStarsTopFloorOk = !(
    gN >= REPUTATION_PEER_TOP_MIN_REVIEW_COUNT &&
    gAvg != null &&
    Number.isFinite(gAvg) &&
    gAvg < REPUTATION_PEER_TOP_MIN_AVG_STARS
  )
  return {
    needMoreCleanStays: needClean,
    pointsToTargetPercent: needScore,
    disputesOk: disputeOk,
    penaltiesOk: penaltyOk,
    slaTopOk,
    guestReviewsTopOk,
    guestStarsTopFloorOk,
    atTop: snap.tier === 'TOP',
  }
}
