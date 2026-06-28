/**
 * PDP hero gallery + skeleton height SSOT.
 */

/** Mobile hero — same aspect as catalog cards (reliable on iOS/PWA; avoid vh collapse). */
export const PDP_HERO_MOBILE_ASPECT_CLASS = 'aspect-[4/3] w-full'

/** Desktop bento band inside `max-w-7xl`. */
export const PDP_HERO_DESKTOP_CLASS = 'h-[min(50vw,480px)] min-h-[320px] max-h-[480px]'

export const PDP_HERO_SECTION_MB = 'mb-8 md:mb-12'

export const PDP_HERO_SKELETON_CLASS = `aspect-[4/3] w-full md:aspect-auto ${PDP_HERO_DESKTOP_CLASS} rounded-2xl`

export const PDP_MAP_FALLBACK_CLASS = 'h-[400px]'
