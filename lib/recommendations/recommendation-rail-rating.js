/**
 * Compact rail rating SSOT (Stage 201.108). Honest: hide when there are no reviews/score.
 */

/**
 * @param {object | null | undefined} listing
 * @returns {{ rating: number, reviewsCount: number, show: boolean }}
 */
export function resolveRecommendationRailRating(listing) {
  const rating =
    parseFloat(
      listing?.rating ?? listing?.avgRating ?? listing?.average_rating ?? listing?.avg_rating ?? 0,
    ) || 0
  const reviewsCount = parseInt(
    listing?.reviewsCount ?? listing?.reviews_count ?? 0,
    10,
  ) || 0
  const safeRating = Number.isFinite(rating) && rating > 0 ? rating : 0
  return {
    rating: safeRating,
    reviewsCount: reviewsCount > 0 ? reviewsCount : 0,
    show: safeRating > 0,
  }
}
