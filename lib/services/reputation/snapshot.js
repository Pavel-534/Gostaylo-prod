import { supabaseAdmin } from '@/lib/supabase'
import { getSlaMetricsForPartners30d } from '@/lib/services/partner-response-performance'
import {
  fetchFinancialReliabilityInputs,
  fetchGuestToPartnerReviewRollupForPartner,
  fetchPartnerAuthoredGuestReviewCount,
} from './data-provider.js'
import { computeReliabilityFromCounts } from './formula.js'

function emptySnapshot(partnerId) {
  const pid = String(partnerId || '').trim()
  return {
    partnerId: pid,
    completedTotal: 0,
    weightedDisputedUnits: 0,
    bookingsWithAnyDisputeRaw: 0,
    cleanCompleted: 0,
    penaltyPointsSum: 0,
    penaltyPointsSumWeighted: 0,
    penaltyCount: 0,
    penaltyCountWeighted: 0,
    partnerDeclinedCount: 0,
    partnerDeclinedWeighted: 0,
    partnerInitiatedCancelCount: 0,
    partnerCancelWeighted: 0,
    avgInitialResponseMinutes30d: null,
    initialResponseSampleCount30d: 0,
    guestReviewCount: 0,
    guestReviewAvgStars: null,
    partnerAuthoredGuestReviewCount: 0,
    topBlockedByGuestReviews: false,
    reliabilityPercent: null,
    tier: 'NEW',
  }
}

export async function computePartnerReliabilitySnapshot(partnerId) {
  const pid = String(partnerId || '').trim()
  const empty = emptySnapshot(pid)
  if (!pid || !supabaseAdmin) return { ...empty, tier: 'NEW', reliabilityPercent: null }

  const [slaMap, guestRollup, partnerAuthoredGuestReviewCount, fin] = await Promise.all([
    getSlaMetricsForPartners30d([pid]),
    fetchGuestToPartnerReviewRollupForPartner(pid),
    fetchPartnerAuthoredGuestReviewCount(pid),
    fetchFinancialReliabilityInputs(pid),
  ])

  const slaRow = slaMap.get(pid) || { avgMinutes: null, count: 0 }
  const slaAvgInitialResponseMinutes30d =
    slaRow.count > 0 && slaRow.avgMinutes != null ? slaRow.avgMinutes : null
  const slaInitialResponseSampleCount30d = slaRow.count || 0
  const guestReviewCount = guestRollup?.count || 0
  const guestReviewAvgStars =
    guestReviewCount > 0 && guestRollup?.averageRating != null && Number.isFinite(guestRollup.averageRating)
      ? guestRollup.averageRating
      : null

  const {
    completedTotal,
    weightedDisputedUnits,
    bookingsWithAnyDisputeRaw,
    penaltyPointsSum,
    penaltyPointsSumWeighted,
    penaltyCount,
    penaltyCountWeighted,
    partnerDeclinedCount,
    partnerDeclinedWeighted,
    partnerInitiatedCancelCount,
    partnerCancelWeighted,
  } = fin

  const { reliabilityPercent, tier, cleanCompleted, topBlockedByGuestReviews } = computeReliabilityFromCounts({
    completedTotal,
    weightedDisputedUnits,
    penaltyPointsSumWeighted,
    penaltyCountWeighted,
    partnerDeclinedWeighted,
    partnerCancelWeighted,
    slaAvgInitialResponseMinutes30d,
    slaInitialResponseSampleCount30d,
    guestReviewAvgStars,
    guestReviewCount,
  })

  return {
    partnerId: pid,
    completedTotal,
    weightedDisputedUnits,
    bookingsWithAnyDisputeRaw,
    cleanCompleted,
    penaltyPointsSum,
    penaltyPointsSumWeighted,
    penaltyCount,
    penaltyCountWeighted,
    partnerDeclinedCount,
    partnerDeclinedWeighted,
    partnerInitiatedCancelCount,
    partnerCancelWeighted,
    avgInitialResponseMinutes30d: slaAvgInitialResponseMinutes30d,
    initialResponseSampleCount30d: slaInitialResponseSampleCount30d,
    guestReviewCount,
    guestReviewAvgStars,
    partnerAuthoredGuestReviewCount,
    topBlockedByGuestReviews,
    reliabilityPercent,
    tier,
  }
}
