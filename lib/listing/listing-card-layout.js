/**
 * Stage 170.11 / 199.1 — catalog `ListingCard` body layout SSOT (equal-height grids).
 * Stage 199.1 — mobile search density: media + body stay under ~80dvh so the next card peeks.
 * Stage 200.136 — wizard/solo preview uses `layout="solo"` (no h-full stretch void).
 */

/** Catalog card media frame — shared by real card and skeleton to avoid CLS. */
export const LISTING_CARD_MEDIA_ASPECT =
  'aspect-[5/4] max-h-[min(48dvh,20rem)] sm:aspect-[4/3] sm:max-h-none'

/** Soft mobile height budget (document target); media aspect enforces density. */
export const LISTING_CARD_ROOT_MAX_H = 'max-h-[80dvh] sm:max-h-none'

/** Catalog list grid — shared by real list and loading skeleton. */
export const LISTING_CATALOG_GRID_CLASSES =
  'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 sm:gap-5 items-stretch'

/** Mobile catalog refetch skeleton count (~one screen, single column). */
export const MOBILE_CATALOG_SKELETON_COUNT = 4

/** Desktop / initial catalog skeleton count. */
export const DESKTOP_CATALOG_SKELETON_COUNT = 8

/** Title row reserves space for optional rating column. */
export const LISTING_CARD_TITLE_ROW_MIN_H = 'min-h-[2.5rem] sm:min-h-[3.25rem]'

/** Spec icons row — same height when vertical has 0–N chips. */
export const LISTING_CARD_SPEC_ROW_MIN_H = 'min-h-6 sm:min-h-7'

/** Trust badges strip (compact); collapses when empty. */
export const LISTING_CARD_TRUST_ROW_MIN_H = 'min-h-4 sm:min-h-5'

/** Text block below image (excludes price footer). */
export const LISTING_CARD_CONTENT_MIN_H = 'min-h-[5.25rem] sm:min-h-[7.5rem]'

/** Price footer row anchor (prevents bottom jitter on variable badges). */
export const LISTING_CARD_PRICE_ROW_MIN_H = 'min-h-8 sm:min-h-10'

/** Body padding inside catalog card link. */
export const LISTING_CARD_BODY_PAD = 'p-3 sm:p-4'
