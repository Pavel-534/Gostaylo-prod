/**
 * Single place to build listing image URLs for guest UI: Supabase public URLs → same-origin
 * `/_storage/...` so `next/image` can optimize (WebP/AVIF) without hitting raw supabase host.
 * @see `lib/public-image-url.js` (`toPublicImageUrl` → `lib/supabase-proxy-urls.js`)
 */
import { toPublicImageUrl } from '@/lib/public-image-url'

/**
 * Ordered gallery URLs: cover first, then others, de-duplicated, all proxy-normalized.
 * @param {{ coverImage?: string, images?: string[] } | null | undefined} listing
 * @returns {string[]}
 */
export function getListingDisplayImageUrls(listing) {
  if (!listing) return []
  const out = []
  const seen = new Set()
  const add = (raw) => {
    if (!raw || typeof raw !== 'string') return
    const u = toPublicImageUrl(raw) || raw
    if (!u || seen.has(u)) return
    seen.add(u)
    out.push(u)
  }
  if (listing.coverImage) add(listing.coverImage)
  if (Array.isArray(listing.images)) {
    for (const img of listing.images) {
      if (img !== listing.coverImage) add(img)
    }
  }
  return out
}
