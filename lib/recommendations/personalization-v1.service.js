/**
 * Stage 167.2 — «Для вас» personalization v1 (non-ML, ADR-167 §2.8).
 *
 * Scoring (weights sum to 1.0):
 *   40% — category/wizard affinity from listing_views (7d)
 *   30% — category affinity from favorites
 *   20% — proximity to geo centroid of recent views
 *   10% — featured + partner reputation tier + rating
 */

import { supabaseAdmin } from '@/lib/supabase'
import { haversineKm } from '@/lib/api/search/params'
import { fetchListingDistancesWithinRadius } from '@/lib/api/search/spatial-filter'
import { LISTINGS_SELECT_LITE } from '@/lib/api/search/listing-search-payload'
import { isExcludedFromPublicCatalog } from '@/lib/e2e/test-listing-cleanup'
import { getCommissionRate } from '@/lib/commission/get-commission-rate-server.js'
import { resolveDefaultCommissionPercent } from '@/lib/services/currency.service'
import { ReputationService } from '@/lib/services/reputation.service'
import { serializeRecommendationCards } from '@/lib/recommendations/serialize-recommendation-card'
import { resolveWhereSortCenter } from '@/lib/geo/catalog-sort-centers'
import { buildSmartWhereOrClause } from '@/lib/api/search/location-filter'
import {
  PERSONALIZATION_VIEW_WINDOW_DAYS,
  PERSONALIZATION_MIN_RESULTS,
  PERSONALIZATION_MAX_RESULTS,
  PERSONALIZATION_DEFAULT_LIMIT,
  PERSONALIZATION_CANDIDATE_RADIUS_KM,
  PERSONALIZATION_WEIGHTS,
} from '@/lib/recommendations/constants'
import { GUEST_VIEWED_TTL_DAYS } from '@/lib/guest/constants.js'
import { pruneGuestViewedItems } from '@/lib/guest/guest-signals.js'

const LISTING_SELECT = `
  ${LISTINGS_SELECT_LITE}
`

const SIGNAL_LISTING_SELECT = `
  id,
  category_id,
  latitude,
  longitude,
  categories:category_id (slug, wizard_profile)
`

/**
 * @typedef {Object} CategoryAffinityMap
 * @property {Map<string, number>} byCategoryId
 * @property {Map<string, number>} byWizardProfile
 */

/**
 * @typedef {Object} PersonalizationContext
 * @property {Set<string>} excludeListingIds
 * @property {CategoryAffinityMap} viewAffinity
 * @property {CategoryAffinityMap} favoriteAffinity
 * @property {{ lat: number, lng: number } | null} viewCentroid
 * @property {boolean} hasPersonalSignals
 */

/**
 * @param {CategoryAffinityMap} map
 */
function maxAffinity(map) {
  let max = 0
  for (const v of map.byCategoryId.values()) max = Math.max(max, v)
  for (const v of map.byWizardProfile.values()) max = Math.max(max, v)
  return max || 1
}

/**
 * @returns {CategoryAffinityMap}
 */
function emptyAffinity() {
  return { byCategoryId: new Map(), byWizardProfile: new Map() }
}

/**
 * @param {CategoryAffinityMap} map
 * @param {object | null | undefined} listing
 * @param {number} weight
 */
function addAffinity(map, listing, weight) {
  if (!listing || weight <= 0) return
  const catId = listing.category_id ?? listing.categoryId
  if (catId) {
    const key = String(catId)
    map.byCategoryId.set(key, (map.byCategoryId.get(key) || 0) + weight)
  }
  const wizard = listing.categories?.wizard_profile ?? listing.category?.wizard_profile
  if (wizard) {
    const key = String(wizard)
    map.byWizardProfile.set(key, (map.byWizardProfile.get(key) || 0) + weight)
  }
}

/**
 * @param {CategoryAffinityMap} map
 * @param {object} listing
 */
function affinityMatchScore(map, listing) {
  const catId = listing.category_id ?? listing.categoryId
  const wizard = listing.categories?.wizard_profile ?? listing.category?.wizard_profile
  let raw = 0
  if (catId) raw += map.byCategoryId.get(String(catId)) || 0
  if (wizard) raw += map.byWizardProfile.get(String(wizard)) || 0
  return Math.min(1, raw / maxAffinity(map))
}

/**
 * @param {object} listing
 * @param {{ lat: number, lng: number } | null} centroid
 */
export function scoreGeoCentroidProximity(listing, centroid) {
  if (!centroid) return 0.5
  const lat = parseFloat(listing.latitude)
  const lng = parseFloat(listing.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 0.25
  const km = haversineKm(centroid.lat, centroid.lng, lat, lng)
  return Math.max(0, 1 - km / PERSONALIZATION_CANDIDATE_RADIUS_KM)
}

const TIER_REP_SCORE = {
  PLATINUM: 1,
  GOLD: 0.85,
  SILVER: 0.65,
  BRONZE: 0.45,
  NEW: 0.3,
  DEFAULT: 0.25,
}

/**
 * @param {object} listing
 * @param {Map<string, object>} trustByOwner
 */
export function scoreReputationBoost(listing, trustByOwner) {
  const ownerId = String(listing.owner_id || '')
  const tier = String(trustByOwner.get(ownerId)?.tier || 'NEW').toUpperCase()
  const tierScore = TIER_REP_SCORE[tier] ?? TIER_REP_SCORE.DEFAULT
  const rating = parseFloat(listing.avg_rating ?? listing.rating) || 0
  const ratingNorm = Math.min(1, Math.max(0, rating / 5))
  const featured = listing.is_featured === true ? 0.35 : 0
  return Math.min(1, tierScore * 0.55 + ratingNorm * 0.35 + featured)
}

/**
 * @param {object} listing
 * @param {PersonalizationContext} ctx
 * @param {Map<string, object>} trustByOwner
 */
export function scoreForYouListing(listing, ctx, trustByOwner) {
  const recentScore = ctx.hasPersonalSignals
    ? affinityMatchScore(ctx.viewAffinity, listing)
    : 0
  const favScore = affinityMatchScore(ctx.favoriteAffinity, listing)
  const geoScore = scoreGeoCentroidProximity(listing, ctx.viewCentroid)
  const repScore = scoreReputationBoost(listing, trustByOwner)

  const w = PERSONALIZATION_WEIGHTS
  const total =
    w.recentViews * recentScore +
    w.favoritesCategory * favScore +
    w.geoCentroid * geoScore +
    w.reputation * repScore

  return {
    total,
    breakdown: {
      recentViews: recentScore,
      favoritesCategory: favScore,
      geoCentroid: geoScore,
      reputation: repScore,
    },
  }
}

/**
 * @param {string} userId
 * @returns {Promise<PersonalizationContext>}
 */
async function loadPersonalizationContext(userId) {
  const uid = String(userId || '').trim()
  const since = new Date(
    Date.now() - PERSONALIZATION_VIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()

  const excludeListingIds = new Set()
  const viewAffinity = emptyAffinity()
  const favoriteAffinity = emptyAffinity()
  /** @type {{ lat: number, lng: number, weight: number }[]} */
  const geoPoints = []

  const [viewsRes, favRes] = await Promise.all([
    supabaseAdmin
      .from('listing_views')
      .select(`listing_id, viewed_at, listings (${SIGNAL_LISTING_SELECT})`)
      .eq('user_id', uid)
      .gte('viewed_at', since)
      .order('viewed_at', { ascending: false })
      .limit(40),
    supabaseAdmin
      .from('favorites')
      .select(`listing_id, listings (${SIGNAL_LISTING_SELECT})`)
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(40),
  ])

  const now = Date.now()
  for (const row of viewsRes.data || []) {
    const listing = row?.listings
    const id = String(row?.listing_id || listing?.id || '')
    if (id) excludeListingIds.add(id)
    if (!listing) continue

    const viewedAt = Date.parse(row.viewed_at) || now
    const ageDays = Math.max(0, (now - viewedAt) / (24 * 60 * 60 * 1000))
    const weight = Math.max(0.15, 1 - ageDays / PERSONALIZATION_VIEW_WINDOW_DAYS)
    addAffinity(viewAffinity, listing, weight)

    const lat = parseFloat(listing.latitude)
    const lng = parseFloat(listing.longitude)
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      geoPoints.push({ lat, lng, weight })
    }
  }

  for (const row of favRes.data || []) {
    addAffinity(favoriteAffinity, row?.listings, 1)
  }

  let viewCentroid = null
  if (geoPoints.length > 0) {
    const weightSum = geoPoints.reduce((s, p) => s + p.weight, 0) || 1
    const lat = geoPoints.reduce((s, p) => s + p.lat * p.weight, 0) / weightSum
    const lng = geoPoints.reduce((s, p) => s + p.lng * p.weight, 0) / weightSum
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      viewCentroid = { lat, lng }
    }
  }

  const hasPersonalSignals =
    viewAffinity.byCategoryId.size > 0 ||
    viewAffinity.byWizardProfile.size > 0 ||
    favoriteAffinity.byCategoryId.size > 0 ||
    favoriteAffinity.byWizardProfile.size > 0 ||
    viewCentroid != null

  return {
    excludeListingIds,
    viewAffinity,
    favoriteAffinity,
    viewCentroid,
    hasPersonalSignals,
  }
}

/**
 * Guest cookie signals — category/geo affinity without auth (Stage 169.5).
 *
 * @param {Array<{ id: string, t: number }>} guestViewItems
 * @returns {Promise<PersonalizationContext>}
 */
async function loadGuestPersonalizationContext(guestViewItems) {
  const items = pruneGuestViewedItems(guestViewItems)
  const ids = items.map((row) => row.id)
  const excludeListingIds = new Set(ids)
  const viewAffinity = emptyAffinity()
  const favoriteAffinity = emptyAffinity()
  /** @type {{ lat: number, lng: number, weight: number }[]} */
  const geoPoints = []

  if (ids.length === 0) {
    return {
      excludeListingIds,
      viewAffinity,
      favoriteAffinity,
      viewCentroid: null,
      hasPersonalSignals: false,
    }
  }

  const { data, error } = await supabaseAdmin
    .from('listings')
    .select(`id, category_id, latitude, longitude, categories:category_id (slug, wizard_profile)`)
    .in('id', ids)
    .eq('status', 'ACTIVE')

  if (error) {
    console.error('[personalization-v1] guest signals load failed', error.message || error)
  }

  const byId = new Map((data || []).map((row) => [String(row.id), row]))
  const now = Date.now()

  for (const { id, t } of items) {
    const listing = byId.get(String(id))
    if (!listing) continue

    const viewedAt = Number.isFinite(t) ? t * 1000 : now
    const ageDays = Math.max(0, (now - viewedAt) / (24 * 60 * 60 * 1000))
    const weight = Math.max(0.1, 1 - ageDays / GUEST_VIEWED_TTL_DAYS)
    addAffinity(viewAffinity, listing, weight)

    const lat = parseFloat(listing.latitude)
    const lng = parseFloat(listing.longitude)
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      geoPoints.push({ lat, lng, weight })
    }
  }

  let viewCentroid = null
  if (geoPoints.length > 0) {
    const weightSum = geoPoints.reduce((s, p) => s + p.weight, 0) || 1
    const lat = geoPoints.reduce((s, p) => s + p.lat * p.weight, 0) / weightSum
    const lng = geoPoints.reduce((s, p) => s + p.lng * p.weight, 0) / weightSum
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      viewCentroid = { lat, lng }
    }
  }

  const hasPersonalSignals =
    viewAffinity.byCategoryId.size > 0 ||
    viewAffinity.byWizardProfile.size > 0 ||
    viewCentroid != null

  return {
    excludeListingIds,
    viewAffinity,
    favoriteAffinity,
    viewCentroid,
    hasPersonalSignals,
  }
}

/**
 * @param {Array<{ id: string, t: number }>} guestViewItems
 * @param {{ where?: string | null, limit?: number }} [opts]
 */
export async function getGuestPersonalizedForYouRecommendations(guestViewItems, opts = {}) {
  const limit = clampLimit(opts.limit)
  const ctx = await loadGuestPersonalizationContext(guestViewItems)
  const signalCount = pruneGuestViewedItems(guestViewItems).length

  if (!ctx.hasPersonalSignals) {
    const fallback = await getRegionalPopularRecommendations(opts)
    return {
      ...fallback,
      meta: {
        ...fallback.meta,
        mode: 'regional_popular',
        reason: 'no_guest_signals',
        authenticated: false,
        guest_signals: signalCount,
      },
    }
  }

  const centroid = ctx.viewCentroid ?? resolveWhereSortCenter({ where: opts.where })
  const candidates = await fetchCandidateListings({
    where: opts.where,
    centroid,
    excludeIds: ctx.excludeListingIds,
    fetchLimit: Math.max(limit * 6, 90),
  })

  const ownerIds = [...new Set(candidates.map((l) => l.owner_id).filter(Boolean))]
  let trustByOwner = new Map()
  try {
    trustByOwner = await ReputationService.getPartnersTrustPublicBatch(ownerIds)
  } catch {
    /* optional */
  }

  const guestCtx = { ...ctx, hasPersonalSignals: true, favoriteAffinity: emptyAffinity() }

  const ranked = candidates
    .map((listing) => ({
      listing,
      ...scoreForYouListing(listing, guestCtx, trustByOwner),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)

  if (ranked.length < PERSONALIZATION_MIN_RESULTS) {
    const fallback = await getRegionalPopularRecommendations({ where: opts.where, limit })
    const { guestServiceFeePercent } = await getCommissionRate()
    const defaultCommission = resolveDefaultCommissionPercent()
    const serializedRanked = await serializeRecommendationCards(
      ranked.map((r) => r.listing),
      { guestServiceFeePercent, defaultCommission },
    )
    const seen = new Set(serializedRanked.map((l) => String(l.id)))
    const listings = [
      ...serializedRanked,
      ...fallback.listings.filter((l) => !seen.has(String(l.id))),
    ].slice(0, limit)

    return {
      listings,
      meta: {
        mode: 'guest_personalized_topup',
        count: listings.length,
        weights: PERSONALIZATION_WEIGHTS,
        authenticated: false,
        guest_signals: signalCount,
      },
    }
  }

  const { guestServiceFeePercent } = await getCommissionRate()
  const defaultCommission = resolveDefaultCommissionPercent()
  const listings = await serializeRecommendationCards(
    ranked.map((r) => r.listing),
    { guestServiceFeePercent, defaultCommission },
  )

  return {
    listings,
    meta: {
      mode: 'guest_personalized',
      count: listings.length,
      weights: PERSONALIZATION_WEIGHTS,
      centroid: centroid ?? null,
      authenticated: false,
      guest_signals: signalCount,
    },
  }
}

/**
 * @param {{ where?: string | null, centroid?: { lat: number, lng: number } | null, excludeIds?: Set<string>, fetchLimit?: number }} opts
 */
async function fetchCandidateListings(opts = {}) {
  const fetchLimit = opts.fetchLimit ?? 180
  const excludeIds = opts.excludeIds ?? new Set()
  const centroid = opts.centroid ?? resolveWhereSortCenter({ where: opts.where })

  let spatialIds = null
  if (centroid) {
    const hit = await fetchListingDistancesWithinRadius(
      centroid.lat,
      centroid.lng,
      PERSONALIZATION_CANDIDATE_RADIUS_KM,
    )
    spatialIds = hit?.orderedIds?.slice(0, fetchLimit) ?? null
  }

  let query = supabaseAdmin.from('listings').select(LISTING_SELECT).eq('status', 'ACTIVE')

  if (spatialIds?.length) {
    query = query.in('id', spatialIds)
  } else if (opts.where && opts.where !== 'all') {
    const orClause = await buildSmartWhereOrClause(opts.where)
    if (orClause) query = query.or(orClause)
  }

  query = query
    .order('is_featured', { ascending: false })
    .order('avg_rating', { ascending: false, nullsFirst: false })
    .order('bookings_count', { ascending: false })
    .limit(fetchLimit)

  const { data, error } = await query
  if (error) {
    console.error('[personalization-v1] candidates failed', error.message || error)
    return []
  }

  return (data || []).filter((row) => {
    if (!row?.id) return false
    if (excludeIds.has(String(row.id))) return false
    if (isExcludedFromPublicCatalog(row)) return false
    return true
  })
}

/**
 * Anonymous / cold-start: popular listings in region.
 *
 * @param {{ where?: string | null, limit?: number }} [opts]
 */
export async function getRegionalPopularRecommendations(opts = {}) {
  const limit = clampLimit(opts.limit)
  const candidates = await fetchCandidateListings({
    where: opts.where,
    fetchLimit: Math.max(limit * 4, 60),
  })

  const ownerIds = [...new Set(candidates.map((l) => l.owner_id).filter(Boolean))]
  let trustByOwner = new Map()
  try {
    trustByOwner = await ReputationService.getPartnersTrustPublicBatch(ownerIds)
  } catch {
    /* optional */
  }

  const ranked = [...candidates]
    .map((listing) => ({
      listing,
      score: scoreReputationBoost(listing, trustByOwner),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      const bc = Number(b.listing.bookings_count) || 0
      const ac = Number(a.listing.bookings_count) || 0
      return bc - ac
    })
    .slice(0, limit)
    .map((row) => row.listing)

  const { guestServiceFeePercent } = await getCommissionRate()
  const defaultCommission = resolveDefaultCommissionPercent()
  const listings = await serializeRecommendationCards(ranked, {
    guestServiceFeePercent,
    defaultCommission,
  })

  return {
    listings,
    meta: {
      mode: 'regional_popular',
      count: listings.length,
      where: opts.where || null,
    },
  }
}

/**
 * @param {string} userId
 * @param {{ where?: string | null, limit?: number }} [opts]
 */
export async function getPersonalizedForYouRecommendations(userId, opts = {}) {
  const uid = String(userId || '').trim()
  if (!uid) {
    return getRegionalPopularRecommendations(opts)
  }

  const limit = clampLimit(opts.limit)
  const ctx = await loadPersonalizationContext(uid)

  if (!ctx.hasPersonalSignals) {
    const fallback = await getRegionalPopularRecommendations(opts)
    return {
      ...fallback,
      meta: { ...fallback.meta, mode: 'regional_popular', reason: 'no_personal_signals' },
    }
  }

  const centroid = ctx.viewCentroid ?? resolveWhereSortCenter({ where: opts.where })
  const candidates = await fetchCandidateListings({
    where: opts.where,
    centroid,
    excludeIds: ctx.excludeListingIds,
    fetchLimit: Math.max(limit * 6, 90),
  })

  const ownerIds = [...new Set(candidates.map((l) => l.owner_id).filter(Boolean))]
  let trustByOwner = new Map()
  try {
    trustByOwner = await ReputationService.getPartnersTrustPublicBatch(ownerIds)
  } catch {
    /* optional */
  }

  const ranked = candidates
    .map((listing) => ({
      listing,
      ...scoreForYouListing(listing, ctx, trustByOwner),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)

  if (ranked.length < PERSONALIZATION_MIN_RESULTS) {
    const fallback = await getRegionalPopularRecommendations({
      where: opts.where,
      limit,
    })
    const { guestServiceFeePercent } = await getCommissionRate()
    const defaultCommission = resolveDefaultCommissionPercent()
    const serializedRanked = await serializeRecommendationCards(
      ranked.map((r) => r.listing),
      { guestServiceFeePercent, defaultCommission },
    )
    const seen = new Set(serializedRanked.map((l) => String(l.id)))
    const listings = [
      ...serializedRanked,
      ...fallback.listings.filter((l) => !seen.has(String(l.id))),
    ].slice(0, limit)

    return {
      listings,
      meta: {
        mode: 'personalized_topup',
        count: listings.length,
        weights: PERSONALIZATION_WEIGHTS,
      },
    }
  }

  const { guestServiceFeePercent } = await getCommissionRate()
  const defaultCommission = resolveDefaultCommissionPercent()
  const listings = await serializeRecommendationCards(
    ranked.map((r) => r.listing),
    { guestServiceFeePercent, defaultCommission },
  )

  return {
    listings,
    meta: {
      mode: 'personalized',
      count: listings.length,
      weights: PERSONALIZATION_WEIGHTS,
      centroid: centroid ?? null,
    },
  }
}

/**
 * @param {number | undefined} limit
 */
function clampLimit(limit) {
  const n = Number(limit)
  if (!Number.isFinite(n)) return PERSONALIZATION_DEFAULT_LIMIT
  return Math.min(Math.max(n, PERSONALIZATION_MIN_RESULTS), PERSONALIZATION_MAX_RESULTS)
}

/**
 * @param {{ userId?: string | null, where?: string | null, limit?: number, guestViewItems?: Array<{ id: string, t: number }> }} input
 */
export async function getForYouRecommendations(input = {}) {
  const { userId, where, limit, guestViewItems } = input
  if (userId) {
    return getPersonalizedForYouRecommendations(userId, { where, limit })
  }
  if (guestViewItems?.length) {
    return getGuestPersonalizedForYouRecommendations(guestViewItems, { where, limit })
  }
  return getRegionalPopularRecommendations({ where, limit })
}
