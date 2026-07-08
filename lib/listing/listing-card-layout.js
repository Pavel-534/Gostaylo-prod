/**
 * Stage 170.11 — catalog `ListingCard` body layout SSOT (equal-height grids).
 */

/** Catalog card media frame — shared by real card and skeleton to avoid CLS. */
export const LISTING_CARD_MEDIA_ASPECT = 'aspect-[4/3]'

/** Catalog list grid — shared by real list and loading skeleton. */
export const LISTING_CATALOG_GRID_CLASSES =
  'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-5 items-stretch'

/** Title row reserves space for optional rating column. */
export const LISTING_CARD_TITLE_ROW_MIN_H = 'min-h-[3.25rem]'

/** Spec icons row — same height when vertical has 0–N chips. */
export const LISTING_CARD_SPEC_ROW_MIN_H = 'min-h-7'

/** Trust badges strip (compact); collapses when empty. */
export const LISTING_CARD_TRUST_ROW_MIN_H = 'min-h-5'

/** Text block below image (excludes price footer). */
export const LISTING_CARD_CONTENT_MIN_H = 'min-h-[7.5rem]'

/** Price footer row anchor (prevents bottom jitter on variable badges). */
export const LISTING_CARD_PRICE_ROW_MIN_H = 'min-h-10'
