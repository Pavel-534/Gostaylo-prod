import {
  REPUTATION_SEARCH_POSITION_BOOST_BY_TIER,
  REPUTATION_SEARCH_TIER_MULTIPLIER,
  REPUTATION_SEARCH_FEATURED_WEIGHT,
  computeSlaSearchBoost,
} from '@/lib/config/reputation-ranking'
import {
  computeContactLeakSearchPenalty,
  isPartnerSearchPenalized,
} from '@/lib/contact-safety/partner-search-penalty'

/**
 * @param {object[]} listings
 * @param {Map<string, object>} trustByOwner
 * @param {object} [opts]
 * @param {Map<string, number>} [opts.strikesByOwner]
 * @param {{ enabled?: boolean, penaltyScore?: number, strikeThreshold?: number }} [opts.searchPenalty]
 */
export function sortListingsByReputationRanking(listings, trustByOwner, opts = {}) {
  const n = listings.length
  const boost = REPUTATION_SEARCH_POSITION_BOOST_BY_TIER
  const mult = REPUTATION_SEARCH_TIER_MULTIPLIER
  const fw = REPUTATION_SEARCH_FEATURED_WEIGHT
  const strikesByOwner = opts.strikesByOwner || new Map()
  const searchPenalty = opts.searchPenalty || { enabled: false, penaltyScore: 0, strikeThreshold: 5 }

  const scored = listings.map((l, i) => {
    const ownerId = String(l.owner_id || '')
    const strikes = strikesByOwner.get(ownerId) ?? 0
    const penalized = isPartnerSearchPenalized(
      strikes,
      searchPenalty.strikeThreshold,
      searchPenalty.enabled,
    )
    const t = trustByOwner.get(ownerId)
    const tier = (t?.tier && String(t.tier).toUpperCase()) || 'NEW'
    const b = boost[tier] ?? boost.DEFAULT ?? 0
    const m = mult[tier] ?? mult.DEFAULT ?? 1
    const featured = !penalized && l.is_featured ? fw : 0
    const sla = computeSlaSearchBoost(t?.avgInitialResponseMinutes30d, t?.initialResponseSampleCount30d ?? 0)
    const base = (n - i) * m + b + sla
    const leakPenalty = computeContactLeakSearchPenalty(ownerId, strikesByOwner, searchPenalty)
    const score = featured + base - leakPenalty
    return { l, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.map((x) => x.l)
}
