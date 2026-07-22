/**
 * Server SSOT: public listing detail DTO for PDP and GET /api/v2/listings/[id].
 * Stage 171.24 (PR-1) — extracted from route handler; no NextResponse here.
 *
 * Side effects (when `incrementViews` is true, default):
 * - Fire-and-forget `listings.views + 1` after guest-gate passes (same as legacy API).
 * - Returned `data.views` reflects incremented count (+1 vs DB row at read time).
 *
 * Manual verification (local dev on :3000):
 * ```bash
 * # Active listing — expect success:true and data.id
 * curl -sS "http://localhost:3000/api/v2/listings/<LISTING_ID>" | jq '.success, .data.id, .data.title'
 *
 * # Unknown id — expect 404
 * curl -sS -w "\nHTTP %{http_code}\n" "http://localhost:3000/api/v2/listings/nonexistent-id-000"
 *
 * # Compare before/after refactor: save JSON and diff keys
 * curl -sS "http://localhost:3000/api/v2/listings/<LISTING_ID>" | jq -S . > after.json
 * ```
 *
 * Unit tests: validation-only paths require DB; use curl below for integration check.
 */

import { supabaseAdmin } from '@/lib/supabase'
import PricingService from '@/lib/services/pricing.service'
import { resolveDefaultCommissionPercent } from '@/lib/services/currency.service'
import { toPublicImageUrl, mapPublicImageUrls } from '@/lib/public-image-url'
import { isStaffRole } from '@/lib/services/chat/access'
import { resolveListingPublicGuestAccess } from '@/lib/listing/listing-public-guest-gate'
import {
  resolveCoordinateRevealLevel,
  serializePublicCoordinates,
} from '@/lib/geo/listing-public-coordinates'
import { fetchRenterBookingsForListingReveal } from '@/lib/geo/public-coordinate-viewer-context'
import { normalizeCancellationPolicy } from '@/lib/cancellation-refund-rules'
import { ReputationService } from '@/lib/services/reputation.service'
import {
  fetchActivePromoRowsForCatalog,
  computeCatalogPromoBadgeForListing,
  computeCatalogFlashUrgencyForListing,
  computeCatalogFlashSocialProofForListing,
  fetchBookingsCreatedTodayCountsByPromoCodes,
} from '@/lib/promo/catalog-promo-badges'
import { getCommissionRate } from '@/lib/commission/get-commission-rate-server.js'
import {
  getGuestDisplayPerNight,
  normalizeGuestServiceFeePercent,
} from '@/lib/pricing/guest-display-price.js'

/**
 * @typedef {Object} GetPublicListingDetailParams
 * @property {string} listingId — listings.id (TEXT in prod)
 * @property {string | null} [viewerId] — current profile id from session
 * @property {string | null} [viewerRole] — uppercased role (ADMIN, PARTNER, …)
 * @property {boolean} [incrementViews=true] — non-blocking views bump after gate (API default)
 */

/**
 * @typedef {Object} PublicListingDetailDto
 * @property {string} id
 * @property {number} views — includes +1 when incrementViews ran
 * @property {object} [category]
 * @property {object} [owner]
 * @property {object} [metadata]
 * @property {object} [catalog_flash_urgency]
 * @property {object} [catalog_flash_social_proof]
 * @property {object} [catalog_promo_badge]
 * @property {object} [partnerTrust]
 * @property {object[]} [seasonalPrices]
 */

/**
 * @typedef {{ ok: true, data: PublicListingDetailDto }} GetPublicListingDetailSuccess
 */

/**
 * @typedef {{ ok: false, httpStatus: number, error: string, code?: string }} GetPublicListingDetailFailure
 */

/** @typedef {GetPublicListingDetailSuccess | GetPublicListingDetailFailure} GetPublicListingDetailResult */

const LISTING_DETAIL_SELECT = `
        *,
        categories (id, name, slug, icon, wizard_profile),
        owner:profiles!owner_id (id, first_name, last_name, is_verified, verification_status, avatar, email, phone)
      `

/**
 * Single listings SELECT for PDP/API (Stage 171.30 P0.5).
 * @param {string} listingId
 * @returns {Promise<object | null>}
 */
export async function fetchPublicListingDbRow(listingId) {
  const id = String(listingId || '').trim()
  if (!id || !supabaseAdmin) return null

  const { data, error } = await supabaseAdmin
    .from('listings')
    .select(LISTING_DETAIL_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error || !data) return null
  return data
}

/**
 * Transform preloaded DB row → public DTO (guest-gate + enrichment).
 *
 * @param {object} params
 * @param {object} params.listing — row from `fetchPublicListingDbRow`
 * @param {string} params.listingId
 * @param {string | null} [params.viewerId]
 * @param {string | null} [params.viewerRole]
 * @param {boolean} [params.incrementViews=true]
 * @returns {Promise<GetPublicListingDetailResult>}
 */
export async function buildPublicListingDetailFromDbRow({
  listing,
  listingId,
  viewerId = null,
  viewerRole = null,
  incrementViews = true,
}) {
  const id = String(listingId || listing?.id || '').trim()
  if (!id || !listing) {
    return { ok: false, httpStatus: 404, error: 'Listing not found' }
  }

  const normalizedViewerId = viewerId != null ? String(viewerId) : null
  const normalizedViewerRole = String(viewerRole || '').toUpperCase()

  const guestAccess = resolveListingPublicGuestAccess({
    listing,
    viewerId: normalizedViewerId,
    viewerRole: normalizedViewerRole,
  })

  if (!guestAccess.allowed) {
    const isModeration = guestAccess.code === 'LISTING_UNDER_MODERATION'
    return {
      ok: false,
      httpStatus: guestAccess.httpStatus,
      code: guestAccess.code,
      error: isModeration ? 'This listing is under moderation' : 'Listing not found',
    }
  }

  if (incrementViews) {
    scheduleListingViewsIncrement(id, listing.views)
  }

  const [seasonalPrices, reviewsCount, commissionSnapshot] = await Promise.all([
    fetchSeasonalPricesForListing(id),
    resolveReviewsCountForListing(listing, id),
    resolveCommissionSnapshotForListing(listing.owner_id),
  ])

  const dynamicCommissionRate = commissionSnapshot.commissionRate
  const guestServiceFeePercent = normalizeGuestServiceFeePercent(
    commissionSnapshot.guestServiceFeePercent,
  )
  const basePriceThbParsed = parseFloat(listing.base_price_thb)
  const guestDisplayPriceThb = getGuestDisplayPerNight({
    base_price_thb: basePriceThbParsed,
    basePriceThb: basePriceThbParsed,
    guestServiceFeePercent,
  })

  let partnerTrust = null
  if (listing.owner_id) {
    try {
      partnerTrust = await ReputationService.getPartnerTrustPublic(String(listing.owner_id))
    } catch (e) {
      console.warn('[LISTING GET] partner trust', e?.message)
    }
  }

  let catalog_promo_badge = null
  let catalog_flash_urgency = null
  let catalog_flash_social_proof = null
  try {
    const promoRows = await fetchActivePromoRowsForCatalog(supabaseAdmin)
    catalog_promo_badge = computeCatalogPromoBadgeForListing(listing, promoRows, 0)
    catalog_flash_urgency = computeCatalogFlashUrgencyForListing(listing, promoRows)
    const flashCodes = (promoRows || [])
      .filter((p) => p.is_flash_sale)
      .map((p) => String(p.code || '').trim().toUpperCase())
      .filter(Boolean)
    const flashTodayCounts = await fetchBookingsCreatedTodayCountsByPromoCodes(
      supabaseAdmin,
      flashCodes,
    )
    catalog_flash_social_proof = computeCatalogFlashSocialProofForListing(
      listing,
      promoRows,
      flashTodayCounts,
    )
  } catch (e) {
    console.warn('[LISTING GET] catalog promo', e?.message)
  }

  const canSeeOwnerPii =
    normalizedViewerId &&
    (normalizedViewerId === String(listing.owner_id) || isStaffRole(normalizedViewerRole))

  let renterBookingsForReveal = []
  if (normalizedViewerId && !canSeeOwnerPii) {
    renterBookingsForReveal = await fetchRenterBookingsForListingReveal(normalizedViewerId, id)
  }

  const coordReveal = resolveCoordinateRevealLevel({
    viewerId: normalizedViewerId,
    viewerRole: normalizedViewerRole,
    listing,
    renterBookings: renterBookingsForReveal,
  })
  const publicCoords = serializePublicCoordinates(listing, coordReveal)

  const viewsAfterIncrement = incrementViews ? (listing.views || 0) + 1 : listing.views || 0

  /** @type {PublicListingDetailDto} */
  const transformed = {
    id: listing.id,
    ownerId: listing.owner_id,
    categoryId: listing.category_id,
    category: listing.categories,
    status: listing.status,
    title: listing.title,
    description: listing.description,
    district: listing.district,
    latitude: publicCoords.latitude,
    longitude: publicCoords.longitude,
    isApproximate: publicCoords.isApproximate,
    locationPrivacyMode: publicCoords.locationPrivacyMode,
    address: publicCoords.address,
    basePriceThb: basePriceThbParsed,
    guestDisplayPriceThb,
    guestServiceFeePercent,
    baseCurrency: listing.base_currency || 'THB',
    commissionRate: dynamicCommissionRate,
    images: mapPublicImageUrls(listing.images || []),
    coverImage: listing.cover_image ? toPublicImageUrl(listing.cover_image) : null,
    metadata: listing.metadata || {},
    available: listing.available,
    isFeatured: listing.is_featured,
    /** Guest UI: Instant Book vs request-to-book (display SSOT; matches `listings.instant_booking`). */
    instantBooking: listing.instant_booking === true,
    minBookingDays: listing.min_booking_days,
    maxBookingDays: listing.max_booking_days,
    cancellationPolicy: normalizeCancellationPolicy(listing.cancellation_policy),
    maxCapacity: (() => {
      const n = parseInt(listing.max_capacity, 10)
      return Number.isFinite(n) && n > 0 ? n : null
    })(),
    views: viewsAfterIncrement,
    bookingsCount: listing.bookings_count || 0,
    rating: parseFloat(listing.rating) || 0,
    avgRating: parseFloat(listing.avg_rating ?? listing.rating) || 0,
    average_rating: parseFloat(listing.avg_rating ?? listing.rating) || 0,
    reviewsCount: reviewsCount || 0,
    ownerVerified: listing.owner?.is_verified === true,
    createdAt: listing.created_at,
    owner: listing.owner
      ? {
          id: listing.owner.id,
          first_name: listing.owner.first_name,
          last_name: listing.owner.last_name,
          is_verified: listing.owner.is_verified,
          verification_status: listing.owner.verification_status,
          avatar: listing.owner.avatar ? toPublicImageUrl(listing.owner.avatar) : null,
          ...(canSeeOwnerPii
            ? {
                email: listing.owner.email ?? null,
                phone: listing.owner.phone ?? null,
              }
            : {}),
        }
      : null,
    seasonalPrices:
      (seasonalPrices || [])?.map((sp) => ({
        id: sp.id,
        startDate: sp.start_date,
        endDate: sp.end_date,
        label: sp.label,
        seasonType: sp.season_type,
        priceDaily: parseFloat(sp.price_daily),
        priceMonthly: sp.price_monthly ? parseFloat(sp.price_monthly) : null,
      })) || [],
    partnerTrust,
    catalog_promo_badge,
    catalog_flash_urgency,
    catalog_flash_social_proof,
  }

  return { ok: true, data: transformed }
}

/**
 * Load and transform a listing for public PDP/API consumers.
 *
 * @param {GetPublicListingDetailParams} params
 * @returns {Promise<GetPublicListingDetailResult>}
 */
export async function getPublicListingDetail({
  listingId,
  viewerId = null,
  viewerRole = null,
  incrementViews = true,
}) {
  const id = String(listingId || '').trim()
  if (!id) {
    return { ok: false, httpStatus: 404, error: 'Listing not found' }
  }

  const listing = await fetchPublicListingDbRow(id)
  if (!listing) {
    return { ok: false, httpStatus: 404, error: 'Listing not found' }
  }

  return buildPublicListingDetailFromDbRow({
    listing,
    listingId: id,
    viewerId,
    viewerRole,
    incrementViews,
  })
}

/**
 * Non-blocking views increment (legacy API behaviour).
 * @param {string} listingId
 * @param {number | null | undefined} currentViews
 */
function scheduleListingViewsIncrement(listingId, currentViews) {
  supabaseAdmin
    .from('listings')
    .update({ views: (currentViews || 0) + 1 })
    .eq('id', listingId)
    .then(() => {})
    .catch(() => {})
}

/**
 * @param {string} listingId
 */
async function fetchSeasonalPricesForListing(listingId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('seasonal_prices')
      .select('*')
      .eq('listing_id', listingId)
      .order('start_date', { ascending: true })
    return error ? [] : data || []
  } catch (e) {
    console.warn('[LISTING] seasonal_prices error:', e?.message)
    return []
  }
}

/**
 * @param {object} listing
 * @param {string} listingId
 */
async function resolveReviewsCountForListing(listing, listingId) {
  try {
    const rc = listing.reviews_count
    if (rc !== null && rc !== undefined) return rc
    const { count, error: countError } = await supabaseAdmin
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('listing_id', listingId)
    return countError ? 0 : count || 0
  } catch (e) {
    console.warn('[LISTING] reviews count error:', e?.message)
    return 0
  }
}

/**
 * @param {string | null | undefined} ownerId
 */
async function resolveCommissionSnapshotForListing(ownerId) {
  try {
    const dummyPrice = 1000
    const commissionCalc = await PricingService.calculateCommission(dummyPrice, ownerId)
    const hostRate = commissionCalc?.commissionRate ?? (await resolveDefaultCommissionPercent())
    const feeSnapshot = await getCommissionRate(ownerId)
    return {
      commissionRate: hostRate,
      guestServiceFeePercent: feeSnapshot.guestServiceFeePercent,
    }
  } catch (e) {
    console.warn('[LISTING] commission error:', e?.message)
    const feeSnapshot = await getCommissionRate(ownerId).catch(() => null)
    return {
      commissionRate: await resolveDefaultCommissionPercent(),
      guestServiceFeePercent: feeSnapshot?.guestServiceFeePercent,
    }
  }
}
