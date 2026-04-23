/**
 * Stage 19.0 — small DTO helpers for public trust payloads (keeps index.js thin).
 * @param {object} snap — output of computePartnerReliabilitySnapshot
 */
export function trustPublicFromSnapshot(snap) {
  return {
    tier: snap.tier,
    reliabilityPercent: snap.reliabilityPercent,
    topPartner: snap.tier === 'TOP',
    completedStays: snap.completedTotal,
    cleanStays: snap.cleanCompleted,
    avgInitialResponseMinutes30d: snap.avgInitialResponseMinutes30d,
    initialResponseSampleCount30d: snap.initialResponseSampleCount30d,
    guestReviewCount: snap.guestReviewCount,
    guestReviewAvgStars: snap.guestReviewAvgStars,
  }
}
