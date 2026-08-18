/** Similar listings — PostGIS radius (meters). */
export const SIMILAR_RADIUS_M = 15_000

/** ±35% price band around anchor `base_price_thb`. */
export const SIMILAR_PRICE_BAND = 0.35

/** Default PDP rail size (8–12). */
export const SIMILAR_DEFAULT_LIMIT = 12

export const SIMILAR_MIN_RESULTS = 4

/**
 * Home/catalog «Популярно рядом» — show from 2 cards so a cold guest still sees the rail
 * (Stage 201.108; was 6 and hid regional popular on a small catalog).
 */
export const FOR_YOU_MIN_RESULTS = 2

/** Mobile discovery — matches project `md` breakpoint (768px). */
export const RECOMMENDATION_MOBILE_MAX_WIDTH_PX = 768

/** For You horizontal rail — max visible cards on mobile. */
export const FOR_YOU_MOBILE_MAX_CARDS = 5

/** Shared rail card — fluid 2-up on mobile; fixed width from `sm` (Stage 200.12). */
export const RECOMMENDATION_RAIL_CARD_CLASS =
  'w-full min-w-0 sm:w-[180px] shrink-0 snap-start'

/**
 * Embla slide basis SSOT — exactly two cards in the mobile viewport;
 * from `sm` restore fixed-width carousel (Stage 170.8).
 */
export const RECOMMENDATION_RAIL_ITEM_CLASS =
  'basis-1/2 pl-3 sm:basis-auto sm:pl-4'

/** Hide For You on catalog below md (search-intent; Stage 200.7 — was 480px). */
export const FOR_YOU_CATALOG_HIDE_MAX_WIDTH_PX = 767

/** PDP recently viewed rail — show from first stored item. */
export const RECENTLY_VIEWED_MIN_PDP = 1

/** Catalog explicit sort values (ADR-167). */
export const CATALOG_SORT_VALUES = ['recommended', 'price_asc', 'price_desc', 'distance']

export const CATALOG_SORT_DEFAULT = 'recommended'

/** Default radius (km) when sort=distance uses lat/lng center. */
export const CATALOG_DISTANCE_SORT_RADIUS_KM = 50

/** Personalization v1 (167.2) — ADR-167 §2.8. Server top-up threshold; UI min is FOR_YOU_MIN_RESULTS. */
export const PERSONALIZATION_VIEW_WINDOW_DAYS = 7
export const PERSONALIZATION_MIN_RESULTS = 6
export const PERSONALIZATION_MAX_RESULTS = 20
export const PERSONALIZATION_DEFAULT_LIMIT = 16
export const PERSONALIZATION_CANDIDATE_RADIUS_KM = 50
export const PERSONALIZATION_WEIGHTS = {
  recentViews: 0.4,
  favoritesCategory: 0.3,
  geoCentroid: 0.2,
  reputation: 0.1,
}
