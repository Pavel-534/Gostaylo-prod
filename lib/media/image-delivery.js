/**
 * Guest image delivery SSOT — catalog + PDP URLs and `next/image` hints (Stage 171.20–21).
 * Upload/compression profiles remain in `lib/services/media/media-profiles.js`.
 */
import {
  resolveImageMainUrl,
  resolveImageThumbDisplayUrl,
} from '@/lib/image-display-url'
import {
  getListingCardBlurDataURL,
  LISTING_CARD_BLUR_DATA_URL,
} from '@/lib/listing-image-blur'

/** Default catalog card — mobile-first SEA. */
export const LISTING_CARD_IMAGE_SIZES = '(max-width: 768px) 100vw, 33vw'

/** save-data / 2g–3g — smaller optimizer requests. */
export const LISTING_CARD_IMAGE_SIZES_CONSTRAINED = '(max-width: 768px) 80vw, 25vw'

/** First N cards in catalog may use LCP `priority` on unconstrained networks. */
export const LISTING_CARD_LCP_PRIORITY_COUNT = 2

/** PDP hero carousel — full width mobile, half desktop bento lead. */
export const PDP_HERO_CAROUSEL_SIZES = '(max-width: 768px) 100vw, 50vw'

export const PDP_HERO_CAROUSEL_SIZES_CONSTRAINED = '(max-width: 768px) 85vw, 45vw'

/** PDP desktop bento — large tile. */
export const PDP_HERO_BENTO_LEAD_SIZES = '(max-width: 1024px) 100vw, 50vw'

export const PDP_HERO_BENTO_LEAD_SIZES_CONSTRAINED = '(max-width: 1024px) 85vw, 45vw'

/** PDP desktop bento — secondary tiles. */
export const PDP_HERO_BENTO_SECONDARY_SIZES = '(max-width: 1024px) 50vw, 25vw'

export const PDP_HERO_BENTO_SECONDARY_SIZES_CONSTRAINED = '(max-width: 1024px) 40vw, 20vw'

/** PDP lightbox — full viewport. */
export const PDP_LIGHTBOX_IMAGE_SIZES = '100vw'

export const PDP_LIGHTBOX_IMAGE_SIZES_CONSTRAINED = '90vw'

/**
 * @param {{ coverImage?: string, cover_image?: string, images?: unknown[] } | null | undefined} listing
 * @param {(raw: unknown) => string | null} resolveUrl
 * @returns {string[]}
 */
function collectListingImageUrls(listing, resolveUrl) {
  if (!listing) return []
  const out = []
  const seen = new Set()
  const coverRaw = listing.coverImage || listing.cover_image
  const add = (raw) => {
    const u = resolveUrl(raw)
    if (!u || seen.has(u)) return
    seen.add(u)
    out.push(u)
  }
  if (coverRaw) add(coverRaw)
  if (Array.isArray(listing.images)) {
    for (const img of listing.images) {
      if (img !== coverRaw && img !== listing.coverImage && img !== listing.cover_image) {
        add(img)
      }
    }
  }
  return out
}

/**
 * Ordered card/preview URLs: thumb when available (Stage 95.2+), else main.
 * @param {{ coverImage?: string, cover_image?: string, images?: unknown[] } | null | undefined} listing
 * @returns {string[]}
 */
export function getListingCardImageUrls(listing) {
  const urls = collectListingImageUrls(
    listing,
    (raw) => resolveImageThumbDisplayUrl(raw) || resolveImageMainUrl(raw),
  )
  return urls.length > 0 ? urls : ['/placeholder.svg']
}

/**
 * PDP hero / bento — full main URLs (cover first). Thumbs are catalog-only;
 * derived `thumb_*` paths often 404 on legacy listings → blank hero (Stage 175 fix).
 * @param {{ coverImage?: string, cover_image?: string, images?: unknown[] } | null | undefined} listing
 * @returns {string[]}
 */
export function getPdpHeroImageUrls(listing) {
  return collectListingImageUrls(listing, resolveImageMainUrl)
}

/**
 * PDP lightbox — full main URLs (cover first, de-duplicated).
 * @param {{ coverImage?: string, cover_image?: string, images?: unknown[] } | null | undefined} listing
 * @returns {string[]}
 */
export function getPdpLightboxImageUrls(listing) {
  return collectListingImageUrls(listing, resolveImageMainUrl)
}

/**
 * @param {{ constrained?: boolean } | null | undefined} quality
 * @returns {string}
 */
export function resolveListingCardImageSizes(quality) {
  if (quality?.constrained) return LISTING_CARD_IMAGE_SIZES_CONSTRAINED
  return LISTING_CARD_IMAGE_SIZES
}

/**
 * @param {'carousel' | 'bento-lead' | 'bento-secondary' | 'lightbox'} variant
 * @param {{ constrained?: boolean } | null | undefined} quality
 * @returns {string}
 */
export function resolvePdpImageSizes(variant, quality) {
  const constrained = quality?.constrained === true
  switch (variant) {
    case 'carousel':
      return constrained ? PDP_HERO_CAROUSEL_SIZES_CONSTRAINED : PDP_HERO_CAROUSEL_SIZES
    case 'bento-lead':
      return constrained ? PDP_HERO_BENTO_LEAD_SIZES_CONSTRAINED : PDP_HERO_BENTO_LEAD_SIZES
    case 'bento-secondary':
      return constrained
        ? PDP_HERO_BENTO_SECONDARY_SIZES_CONSTRAINED
        : PDP_HERO_BENTO_SECONDARY_SIZES
    case 'lightbox':
      return constrained ? PDP_LIGHTBOX_IMAGE_SIZES_CONSTRAINED : PDP_LIGHTBOX_IMAGE_SIZES
    default:
      return PDP_HERO_CAROUSEL_SIZES
  }
}

/**
 * @param {{ cardIndex?: number, enableLcp?: boolean }} options
 * @param {{ constrained?: boolean } | null | undefined} quality
 * @returns {boolean}
 */
export function resolveListingCardImagePriority(options, quality) {
  const cardIndex = Number(options?.cardIndex ?? 0)
  const enableLcp = options?.enableLcp !== false
  if (!enableLcp || quality?.constrained) return false
  return cardIndex < LISTING_CARD_LCP_PRIORITY_COUNT
}

/**
 * LCP for PDP hero — first tile only on unconstrained networks.
 * @param {{ index?: number }} options
 * @param {{ constrained?: boolean } | null | undefined} quality
 * @returns {boolean}
 */
export function resolvePdpHeroImagePriority(options, quality) {
  const index = Number(options?.index ?? 0)
  if (quality?.constrained || index !== 0) return false
  return true
}

/**
 * Carousel slide mount policy — save-data / 2g–3g keeps only the active slide in DOM.
 * @param {number} slideIndex
 * @param {number} activeIndex
 * @param {{ constrained?: boolean } | null | undefined} quality
 * @returns {boolean}
 */
export function shouldMountPdpCarouselSlide(slideIndex, activeIndex, quality) {
  // Hero slide 0 is LCP — never defer mount (carousel height + view-transition depend on it).
  if (slideIndex === 0) return true
  if (quality?.constrained) return slideIndex === activeIndex
  return Math.abs(slideIndex - activeIndex) <= 1
}

/**
 * Desktop bento secondary tiles — hidden on constrained networks (hero only).
 * @param {{ constrained?: boolean } | null | undefined} quality
 * @returns {boolean}
 */
export function shouldMountPdpBentoSecondary(quality) {
  return !quality?.constrained
}

/**
 * Per-listing LQIP when available, else neutral blur.
 * @param {{ metadata?: { card_blur_data_url?: string, blur_data_url?: string } } | null | undefined} listing
 * @returns {string}
 */
export function resolvePdpHeroBlurDataURL(listing) {
  if (!listing) return LISTING_CARD_BLUR_DATA_URL
  return getListingCardBlurDataURL(listing)
}
