/** Similar listings — PostGIS radius (meters). */
export const SIMILAR_RADIUS_M = 15_000

/** ±35% price band around anchor `base_price_thb`. */
export const SIMILAR_PRICE_BAND = 0.35

/** Default PDP rail size (8–12). */
export const SIMILAR_DEFAULT_LIMIT = 12

export const SIMILAR_MIN_RESULTS = 4

/** Catalog explicit sort values (ADR-167). */
export const CATALOG_SORT_VALUES = ['recommended', 'price_asc', 'price_desc', 'distance']

export const CATALOG_SORT_DEFAULT = 'recommended'

/** Default radius (km) when sort=distance uses lat/lng center. */
export const CATALOG_DISTANCE_SORT_RADIUS_KM = 50

/** Personalization v1 (167.2) — ADR-167 §2.8 */
export const PERSONALIZATION_VIEW_WINDOW_DAYS = 7
export const PERSONALIZATION_MIN_RESULTS = 12
export const PERSONALIZATION_MAX_RESULTS = 20
export const PERSONALIZATION_DEFAULT_LIMIT = 16
export const PERSONALIZATION_CANDIDATE_RADIUS_KM = 50
export const PERSONALIZATION_WEIGHTS = {
  recentViews: 0.4,
  favoritesCategory: 0.3,
  geoCentroid: 0.2,
  reputation: 0.1,
}
