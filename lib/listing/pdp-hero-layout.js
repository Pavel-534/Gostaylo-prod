/**
 * PDP hero gallery + skeleton height SSOT (Stage 171.23 — zero CLS).
 */

/** Mobile carousel shell — matches `BentoGallery` mobile block. */
export const PDP_HERO_MOBILE_CLASS = 'h-[50vh] min-h-[280px] max-h-[520px]'

/** Desktop bento — fixed band inside `max-w-7xl` (Airbnb 1+4 grid). */
export const PDP_HERO_DESKTOP_CLASS = 'h-[min(56vw,480px)] min-h-[360px] max-h-[520px]'

/** Shared bottom spacing below hero band. */
export const PDP_HERO_SECTION_MB = 'mb-8 md:mb-12'

/** Loading skeleton — responsive mirror of hero. */
export const PDP_HERO_SKELETON_CLASS = `${PDP_HERO_MOBILE_CLASS} md:h-[min(56vw,480px)] md:min-h-[360px] md:max-h-[520px] w-full rounded-2xl`

/** Map block placeholder height (ListingMap). */
export const PDP_MAP_FALLBACK_CLASS = 'h-[400px]'
