/**
 * Stage 19.0 — small DTO helpers for public trust payloads (keeps index.js thin).
 * @param {object} snap — output of computePartnerReliabilitySnapshot
 */
export function trustPublicFromSnapshot(snap) {
  const completed = Number(snap.completedTotal) || 0
  const clean = Number(snap.cleanCompleted) || 0
  const completionCleanPercent = completed > 0 ? Math.round((1000 * clean) / completed) / 10 : null

  return {
    tier: snap.tier,
    reliabilityPercent: snap.reliabilityPercent,
    topPartner: snap.tier === 'TOP',
    completedStays: completed,
    cleanStays: clean,
    /** Share of completed stays without disputes / partner-cancel noise (0–100, one decimal). */
    completionCleanPercent,
    avgInitialResponseMinutes30d: snap.avgInitialResponseMinutes30d,
    initialResponseSampleCount30d: snap.initialResponseSampleCount30d,
    guestReviewCount: snap.guestReviewCount,
    guestReviewAvgStars: snap.guestReviewAvgStars,
  }
}
