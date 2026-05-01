import {
  REPUTATION_SEARCH_POSITION_BOOST_BY_TIER,
  REPUTATION_SEARCH_TIER_MULTIPLIER,
  REPUTATION_SEARCH_FEATURED_WEIGHT,
  computeSlaSearchBoost,
} from '@/lib/config/reputation-ranking'

export function sortListingsByReputationRanking(listings, trustByOwner) {
  const n = listings.length
  const boost = REPUTATION_SEARCH_POSITION_BOOST_BY_TIER
  const mult = REPUTATION_SEARCH_TIER_MULTIPLIER
  const fw = REPUTATION_SEARCH_FEATURED_WEIGHT
  const scored = listings.map((l, i) => {
    const t = trustByOwner.get(String(l.owner_id))
    const tier = (t?.tier && String(t.tier).toUpperCase()) || 'NEW'
    const b = boost[tier] ?? boost.DEFAULT ?? 0
    const m = mult[tier] ?? mult.DEFAULT ?? 1
    const featured = l.is_featured ? fw : 0
    const sla = computeSlaSearchBoost(t?.avgInitialResponseMinutes30d, t?.initialResponseSampleCount30d ?? 0)
    const base = (n - i) * m + b + sla
    const score = featured + base
    return { l, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.map((x) => x.l)
}
