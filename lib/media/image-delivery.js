/**
 * Guest image delivery SSOT — catalog card URLs + `next/image` hints (Stage 171.20).
 * Upload/compression profiles remain in `lib/services/media/media-profiles.js`.
 */
import {
  resolveImageMainUrl,
  resolveImageThumbDisplayUrl,
} from '@/lib/image-display-url'

/** Default catalog card — mobile-first SEA. */
export const LISTING_CARD_IMAGE_SIZES = '(max-width: 768px) 100vw, 33vw'

/** save-data / 2g–3g — smaller optimizer requests. */
export const LISTING_CARD_IMAGE_SIZES_CONSTRAINED = '(max-width: 768px) 80vw, 25vw'

/** First N cards in catalog may use LCP `priority` on unconstrained networks. */
export const LISTING_CARD_LCP_PRIORITY_COUNT = 2

/**
 * Ordered card/preview URLs: thumb when available (Stage 95.2+), else main.
 * @param {{ coverImage?: string, cover_image?: string, images?: unknown[] } | null | undefined} listing
 * @returns {string[]}
 */
export function getListingCardImageUrls(listing) {
  if (!listing) return ['/placeholder.svg']
  const out = []
  const seen = new Set()
  const coverRaw = listing.coverImage || listing.cover_image
  const add = (raw) => {
    const u = resolveImageThumbDisplayUrl(raw) || resolveImageMainUrl(raw)
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
  return out.length > 0 ? out : ['/placeholder.svg']
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
