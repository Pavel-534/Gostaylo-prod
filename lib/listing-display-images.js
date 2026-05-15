/**
 * Single place to build listing image URLs for guest UI: Supabase public URLs → same-origin
 * `/_storage/...` so `next/image` can optimize (WebP/AVIF) without hitting raw supabase host.
 * @see `lib/public-image-url.js` (`toPublicImageUrl` → `lib/supabase-proxy-urls.js`)
 * @see `lib/image-display-url.js` (thumb vs main, Stage 95.3)
 */
import {
  resolveImageMainUrl,
  resolveImageThumbDisplayUrl,
} from '@/lib/image-display-url'

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
