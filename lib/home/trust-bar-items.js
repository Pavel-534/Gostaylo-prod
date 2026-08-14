/**
 * Stage 201.27 — honest TrustBar tiles.
 * listingsCount from GET /api/v2/public/stats is global — never pair it with a city label.
 */

export const TRUST_BAR_MIN_LISTINGS = 10

/**
 * @param {{ listingsCount?: number | null, avgRating?: number | null } | null | undefined} stats
 */
export function resolveTrustBarMetrics(stats) {
  const listingsCount = Number(stats?.listingsCount)
  const avgRating = Number(stats?.avgRating)
  const hasListings = Number.isFinite(listingsCount) && listingsCount >= TRUST_BAR_MIN_LISTINGS
  const hasRating = Number.isFinite(avgRating) && avgRating > 0
  return {
    listingsCount: hasListings ? listingsCount : null,
    avgRating: hasRating ? avgRating : null,
  }
}
