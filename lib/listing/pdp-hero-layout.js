/**
 * PDP hero gallery + skeleton height SSOT (Stage 171.23 — zero CLS).
 */

/** Mobile carousel shell — matches `BentoGallery` mobile block. */
export const PDP_HERO_MOBILE_CLASS = 'h-[50vh] min-h-[280px] max-h-[520px]'

/** Desktop bento shell — matches `BentoGallery` desktop grid. */
export const PDP_HERO_DESKTOP_CLASS = 'h-[50vh] min-h-[400px] max-h-[600px]'

/** Shared bottom spacing below hero band. */
export const PDP_HERO_SECTION_MB = 'mb-12'

/** Loading skeleton — responsive mirror of hero (mobile + md desktop bounds). */
export const PDP_HERO_SKELETON_CLASS = `${PDP_HERO_MOBILE_CLASS} md:min-h-[400px] md:max-h-[600px] w-full rounded-2xl`

/** Map block placeholder height (ListingMap). */
export const PDP_MAP_FALLBACK_CLASS = 'h-[400px]'
