/**
 * Stage 167.0 — PDP similar listings (category + PostGIS 15 km + price ±35%).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { fetchListingDistancesWithinRadius } from '@/lib/api/search/spatial-filter'
import { LISTINGS_SELECT_LITE } from '@/lib/api/search/listing-search-payload'
import { isExcludedFromPublicCatalog } from '@/lib/e2e/test-listing-cleanup'
import { getCommissionRate } from '@/lib/commission/get-commission-rate-server.js'
import { resolveDefaultCommissionPercent } from '@/lib/services/currency.service'
import {
  SIMILAR_DEFAULT_LIMIT,
  SIMILAR_PRICE_BAND,
  SIMILAR_RADIUS_M,
} from '@/lib/recommendations/constants'
import { serializeRecommendationCards } from '@/lib/recommendations/serialize-recommendation-card'

const ANCHOR_SELECT = `
  ${LISTINGS_SELECT_LITE},
  categories:category_id (
    id,
    slug,
    wizard_profile
  )
`

/**
 * @param {string} listingId
 */
async function loadAnchorListing(listingId) {
  const id = String(listingId || '').trim()
  if (!id) return null

  const { data, error } = await supabaseAdmin
    .from('listings')
    .select(ANCHOR_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[similar-listings] anchor load failed', error.message || error)
    return null
  }
  return data
}

/**
 * @param {object} anchor
 * @param {object} candidate
 */
function matchesSimilarCategory(anchor, candidate) {
  const anchorCategoryId = anchor?.category_id
  const anchorWizard = anchor?.categories?.wizard_profile
  if (anchorCategoryId && candidate?.category_id === anchorCategoryId) return true
  if (anchorWizard && candidate?.categories?.wizard_profile === anchorWizard) return true
  return false
}

/**
 * @param {object} anchor
 * @param {object} candidate
 * @param {number} priceMin
 * @param {number} priceMax
 */
function passesSimilarFilters(anchor, candidate, priceMin, priceMax) {
  if (!candidate || String(candidate.id) === String(anchor.id)) return false
  if (candidate.status !== 'ACTIVE') return false
  if (isExcludedFromPublicCatalog(candidate)) return false
  if (!matchesSimilarCategory(anchor, candidate)) return false

  const price = parseFloat(candidate.base_price_thb)
  if (!Number.isFinite(price) || price < priceMin || price > priceMax) return false
  return true
}

/**
 * @param {object[]} rows
 * @param {Map<string, number>} distanceKmById
 */
function sortSimilarCandidates(rows, distanceKmById) {
  return [...rows].sort((a, b) => {
    const da = distanceKmById.get(String(a.id))
    const db = distanceKmById.get(String(b.id))
    const aDist = Number.isFinite(da) ? da : Number.POSITIVE_INFINITY
    const bDist = Number.isFinite(db) ? db : Number.POSITIVE_INFINITY
    if (aDist !== bDist) return aDist - bDist

    const ra = parseFloat(a.avg_rating ?? a.rating) || 0
    const rb = parseFloat(b.avg_rating ?? b.rating) || 0
    if (rb !== ra) return rb - ra

    const revA = parseInt(a.reviews_count, 10) || 0
    const revB = parseInt(b.reviews_count, 10) || 0
    return revB - revA
  })
}

/**
 * @param {string} anchorListingId
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<{ listings: object[], meta: object }>}
 */
export async function findSimilarListings(anchorListingId, opts = {}) {
  const limit = Math.min(Math.max(opts.limit ?? SIMILAR_DEFAULT_LIMIT, 1), 20)
  const anchor = await loadAnchorListing(anchorListingId)

  if (!anchor || anchor.status !== 'ACTIVE') {
    return { listings: [], meta: { reason: 'anchor_unavailable', count: 0 } }
  }

  const anchorPrice = parseFloat(anchor.base_price_thb)
  const priceMin = Number.isFinite(anchorPrice)
    ? anchorPrice * (1 - SIMILAR_PRICE_BAND)
    : 0
  const priceMax = Number.isFinite(anchorPrice)
    ? anchorPrice * (1 + SIMILAR_PRICE_BAND)
    : Number.POSITIVE_INFINITY

  const anchorLat = parseFloat(anchor.latitude)
  const anchorLng = parseFloat(anchor.longitude)
  const hasCoords = Number.isFinite(anchorLat) && Number.isFinite(anchorLng)

  /** @type {Map<string, number>} */
  let distanceKmById = new Map()
  let candidates = []
  let engine = 'category_fallback'

  if (hasCoords) {
    const radiusKm = SIMILAR_RADIUS_M / 1000
    const spatialHit = await fetchListingDistancesWithinRadius(anchorLat, anchorLng, radiusKm)
    distanceKmById = spatialHit?.distanceKmById ?? new Map()
    engine = spatialHit?.engine ?? 'haversine'

    const ids = (spatialHit?.orderedIds ?? []).filter((id) => id !== String(anchor.id))
    if (ids.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('listings')
        .select(ANCHOR_SELECT)
        .in('id', ids.slice(0, 250))
        .eq('status', 'ACTIVE')

      if (error) {
        console.error('[similar-listings] candidates load failed', error.message || error)
      } else {
        const byId = new Map((data || []).map((row) => [String(row.id), row]))
        candidates = ids.map((id) => byId.get(String(id))).filter(Boolean)
      }
    }
  }

  if (candidates.length === 0) {
    engine = 'category_fallback'
    const { data, error } = await supabaseAdmin
      .from('listings')
      .select(ANCHOR_SELECT)
      .eq('status', 'ACTIVE')
      .eq('category_id', anchor.category_id)
      .neq('id', anchor.id)
      .limit(80)

    if (error) {
      console.error('[similar-listings] category fallback failed', error.message || error)
      return { listings: [], meta: { reason: 'query_error', count: 0 } }
    }
    candidates = data || []
  }

  const filtered = candidates.filter((row) =>
    passesSimilarFilters(anchor, row, priceMin, priceMax),
  )
  const ranked = sortSimilarCandidates(filtered, distanceKmById).slice(0, limit)

  const { guestServiceFeePercent } = await getCommissionRate()
  const defaultCommission = resolveDefaultCommissionPercent()
  const listings = await serializeRecommendationCards(ranked, {
    guestServiceFeePercent,
    defaultCommission,
  })

  return {
    listings,
    meta: {
      count: listings.length,
      anchorId: anchor.id,
      radiusM: hasCoords ? SIMILAR_RADIUS_M : null,
      priceBand: SIMILAR_PRICE_BAND,
      engine,
    },
  }
}
