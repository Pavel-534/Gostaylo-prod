/**
 * Stage 167.0–167.1 — catalog sort SSOT (ADR-167).
 * Единственный публичный модуль политики сортировки каталога.
 */

import {
  REPUTATION_SEARCH_POSITION_BOOST_BY_TIER,
  REPUTATION_SEARCH_TIER_MULTIPLIER,
  REPUTATION_SEARCH_FEATURED_WEIGHT,
  computeSlaSearchBoost,
} from '@/lib/config/reputation-ranking'
import {
  computeContactLeakSearchPenalty,
  isPartnerSearchPenalized,
} from '@/lib/contact-safety/partner-search-penalty'
import { getEffectiveSearchUnitPriceThb } from '@/lib/search/effective-unit-price-for-search'
import {
  CATALOG_SORT_DEFAULT,
  CATALOG_SORT_VALUES,
} from '@/lib/recommendations/constants'

export { CATALOG_SORT_VALUES, CATALOG_SORT_DEFAULT }

/**
 * @param {URLSearchParams | { get: (k: string) => string | null }} searchParams
 * @returns {typeof CATALOG_SORT_VALUES[number]}
 */
export function parseCatalogSort(searchParams) {
  const raw = String(searchParams.get('sort') || '').trim().toLowerCase()
  if (CATALOG_SORT_VALUES.includes(raw)) return raw
  return CATALOG_SORT_DEFAULT
}

/** @deprecated use parseCatalogSort */
export const resolveCatalogSort = parseCatalogSort

/**
 * @param {typeof CATALOG_SORT_VALUES[number]} sort
 * @param {boolean} geoCenter — lat/lng (+ radius) active on search request
 */
export function catalogSortUsesDistance(sort, geoCenter) {
  return sort === 'distance' && geoCenter
}

/**
 * @param {typeof CATALOG_SORT_VALUES[number]} sort
 */
export function catalogSortUsesReputation(sort) {
  return sort === CATALOG_SORT_DEFAULT || sort === 'recommended'
}

/**
 * @param {object[]} listings
 * @param {Map<string, number>} distanceKmById
 */
export function sortListingsByDistance(listings, distanceKmById) {
  return [...listings].sort((a, b) => {
    const da = distanceKmById.get(String(a.id))
    const db = distanceKmById.get(String(b.id))
    const aDist = Number.isFinite(da) ? da : Number.POSITIVE_INFINITY
    const bDist = Number.isFinite(db) ? db : Number.POSITIVE_INFINITY
    return aDist - bDist
  })
}

/**
 * @param {object[]} listings
 * @param {Map<string, object>} trustByOwner
 * @param {object} [opts]
 */
export function sortListingsByReputationRanking(listings, trustByOwner, opts = {}) {
  const n = listings.length
  const boost = REPUTATION_SEARCH_POSITION_BOOST_BY_TIER
  const mult = REPUTATION_SEARCH_TIER_MULTIPLIER
  const fw = REPUTATION_SEARCH_FEATURED_WEIGHT
  const strikesByOwner = opts.strikesByOwner || new Map()
  const searchPenalty = opts.searchPenalty || { enabled: false, penaltyScore: 0, strikeThreshold: 5 }

  const scored = listings.map((l, i) => {
    const ownerId = String(l.owner_id || '')
    const strikes = strikesByOwner.get(ownerId) ?? 0
    const penalized = isPartnerSearchPenalized(
      strikes,
      searchPenalty.strikeThreshold,
      searchPenalty.enabled,
    )
    const t = trustByOwner.get(ownerId)
    const tier = (t?.tier && String(t.tier).toUpperCase()) || 'NEW'
    const b = boost[tier] ?? boost.DEFAULT ?? 0
    const m = mult[tier] ?? mult.DEFAULT ?? 1
    const featured = !penalized && l.is_featured ? fw : 0
    const sla = computeSlaSearchBoost(t?.avgInitialResponseMinutes30d, t?.initialResponseSampleCount30d ?? 0)
    const base = (n - i) * m + b + sla
    const leakPenalty = computeContactLeakSearchPenalty(ownerId, strikesByOwner, searchPenalty)
    const score = featured + base - leakPenalty
    return { l, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.map((x) => x.l)
}

/**
 * @param {object[]} listings
 * @param {typeof CATALOG_SORT_VALUES[number]} sort
 * @param {{
 *   distanceKmById?: Map<string, number>,
 *   trustByOwner?: Map<string, unknown>,
 *   strikesByOwner?: Map<string, number>,
 *   searchPenalty?: object,
 * }} ctx
 */
export function applyCatalogSort(listings, sort, ctx = {}) {
  const rows = Array.isArray(listings) ? listings : []
  const {
    distanceKmById = new Map(),
    trustByOwner = new Map(),
    strikesByOwner = new Map(),
    searchPenalty = { enabled: false, penaltyScore: 0, strikeThreshold: 5 },
  } = ctx

  if (sort === 'distance' && distanceKmById.size > 0) {
    return sortListingsByDistance(rows, distanceKmById)
  }

  if (sort === 'price_asc') {
    return [...rows].sort(
      (a, b) => getEffectiveSearchUnitPriceThb(a) - getEffectiveSearchUnitPriceThb(b),
    )
  }

  if (sort === 'price_desc') {
    return [...rows].sort(
      (a, b) => getEffectiveSearchUnitPriceThb(b) - getEffectiveSearchUnitPriceThb(a),
    )
  }

  return sortListingsByReputationRanking(rows, trustByOwner, {
    strikesByOwner,
    searchPenalty,
  })
}
