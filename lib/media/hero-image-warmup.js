/**
 * Browser image cache warmup for catalog → PDP hero (Stage 171.22).
 */
import { getListingCardImageUrls } from '@/lib/media/image-delivery'

const warmedUrls = new Set()

/**
 * @param {string | { coverImage?: string, cover_image?: string, images?: unknown[] }} listingOrUrl
 */
export function warmupListingHeroThumb(listingOrUrl) {
  if (typeof window === 'undefined') return

  const url =
    typeof listingOrUrl === 'string'
      ? listingOrUrl
      : getListingCardImageUrls(listingOrUrl)[0]

  if (!url || url === '/placeholder.svg' || warmedUrls.has(url)) return

  warmedUrls.add(url)
  const img = new Image()
  img.decoding = 'async'
  img.src = url
}
