/**
 * Stage 167.0 — lite recommendation card shape (catalog parity + ADR-163 coords).
 */

import { toPublicImageUrl, mapPublicImageUrls } from '@/lib/public-image-url'
import { pickLiteListingMetadata } from '@/lib/api/search/listing-search-payload'
import {
  coordinateRevealLevelForListing,
  fetchPublicCoordinateViewerContext,
} from '@/lib/geo/public-coordinate-viewer-context'
import { serializePublicCoordinates } from '@/lib/geo/listing-public-coordinates'
import {
  getGuestDisplayPerNight,
  normalizeGuestServiceFeePercent,
} from '@/lib/pricing/guest-display-price.js'
import { resolveDefaultCommissionPercent } from '@/lib/services/currency.service'

/**
 * @param {object} row — listing DB row (+ optional categories join)
 * @param {{
 *   guestServiceFeePercent?: number,
 *   defaultCommission?: number,
 *   coordViewerContext?: object | null,
 * }} [ctx]
 */
export function toRecommendationCard(row, ctx = {}) {
  if (!row || typeof row !== 'object') return null

  const guestFeePct = normalizeGuestServiceFeePercent(ctx.guestServiceFeePercent ?? 0)
  const defaultListingCommission = ctx.defaultCommission ?? resolveDefaultCommissionPercent()
  const metaRaw = row.metadata || {}
  const imagesMapped = mapPublicImageUrls(row.images || []).slice(0, 3)
  const coordReveal = coordinateRevealLevelForListing(
    row,
    ctx.coordViewerContext ?? null,
  )
  const publicCoords = serializePublicCoordinates(row, coordReveal)
  const basePriceThb = parseFloat(row.base_price_thb)

  return {
    id: row.id,
    ownerId: row.owner_id,
    categoryId: row.category_id,
    categorySlug: row.categories?.slug ?? metaRaw?.category_slug ?? null,
    category: row.categories ?? null,
    status: row.status,
    title: row.title,
    district: row.district,
    city: metaRaw?.city || null,
    latitude: publicCoords.latitude,
    longitude: publicCoords.longitude,
    isApproximate: publicCoords.isApproximate,
    locationPrivacyMode: publicCoords.locationPrivacyMode,
    instantBooking: row.instant_booking === true,
    basePriceThb: Number.isFinite(basePriceThb) ? basePriceThb : 0,
    guestServiceFeePercent: guestFeePct,
    guestDisplayPriceThb: getGuestDisplayPerNight({
      base_price_thb: row.base_price_thb,
      basePriceThb: Number.isFinite(basePriceThb) ? basePriceThb : 0,
      guestServiceFeePercent: guestFeePct,
    }),
    commissionRate: (() => {
      const n = parseFloat(row.commission_rate)
      return Number.isFinite(n) && n >= 0 ? n : defaultListingCommission
    })(),
    images: imagesMapped,
    coverImage: row.cover_image ? toPublicImageUrl(row.cover_image) : null,
    metadata: pickLiteListingMetadata(metaRaw),
    maxCapacity: (() => {
      const n = parseInt(row.max_capacity, 10)
      return Number.isFinite(n) && n > 0 ? n : null
    })(),
    bedrooms: Number.isFinite(Number(row.bedrooms_count))
      ? Number(row.bedrooms_count)
      : (metaRaw?.bedrooms || 0),
    bathrooms: Number.isFinite(Number(row.bathrooms_count))
      ? Number(row.bathrooms_count)
      : (metaRaw?.bathrooms || 0),
    rating: parseFloat(row.avg_rating ?? row.rating) || 0,
    reviewsCount: parseInt(row.reviews_count, 10) || 0,
    isFeatured: row.is_featured === true,
  }
}

/**
 * @param {object[]} rows
 * @param {object} [ctx]
 */
export async function serializeRecommendationCards(rows, ctx = {}) {
  const coordViewerContext =
    ctx.coordViewerContext ?? (await fetchPublicCoordinateViewerContext())
  return (rows || [])
    .map((row) =>
      toRecommendationCard(row, {
        ...ctx,
        coordViewerContext,
      }),
    )
    .filter(Boolean)
}
