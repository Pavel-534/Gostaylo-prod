/**
 * PDP / gallery URLs (full main). Catalog card URLs — SSOT `lib/media/image-delivery.js`.
 */
import { resolveImageMainUrl } from '@/lib/image-display-url'

export { getListingCardImageUrls } from '@/lib/media/image-delivery'

/**
 * Ordered gallery URLs (full main): cover first, then others, de-duplicated.
 * PDP / lightbox / SEO — полное качество.
 * @param {{ coverImage?: string, cover_image?: string, images?: unknown[] } | null | undefined} listing
 * @returns {string[]}
 */
export function getListingDisplayImageUrls(listing) {
  if (!listing) return []
  const out = []
  const seen = new Set()
  const coverRaw = listing.coverImage || listing.cover_image
  const add = (raw) => {
    const u = resolveImageMainUrl(raw)
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
