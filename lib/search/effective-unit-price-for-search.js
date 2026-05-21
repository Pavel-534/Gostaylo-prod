/**
 * Stage 110.1 — фильтр min/max и гистограмма: SSOT гостевой цены (base/avg + guest fee %).
 * @see lib/pricing/guest-display-price.js — getGuestDisplayForSearchFilters
 */

import { LISTINGS_PRICE_SLIDER_MAX_THB } from '@/lib/search/listings-page-url'
import { getGuestDisplayForSearchFilters } from '@/lib/pricing/guest-display-price.js'

/**
 * @param {Record<string, unknown> | null | undefined} listing — строка БД с `_pricing` или DTO с `pricing`
 * @param {{ checkIn?: string, checkOut?: string } | null | undefined} [dates]
 * @returns {number}
 */
export function getEffectiveSearchUnitPriceThb(listing, dates = null) {
  return getGuestDisplayForSearchFilters(listing, dates)
}

/**
 * Фильтр min/max по URL совпадает с тем, что видит пользователь на карточках при заданных датах.
 *
 * @param {Record<string, unknown>} listing
 * @param {number | null | undefined} minPrice
 * @param {number | null | undefined} maxPrice
 * @returns {boolean}
 */
export function listingMatchesSearchPriceRange(listing, minPrice, maxPrice) {
  const eff = getEffectiveSearchUnitPriceThb(listing)
  if (!Number.isFinite(eff) || eff <= 0) return false
  if (minPrice != null && Number.isFinite(minPrice) && eff < minPrice) return false
  if (maxPrice != null && Number.isFinite(maxPrice) && eff > maxPrice) return false
  return true
}

/**
 * Бины гистограммы (как в SearchFiltersDialog): равномерно от 0 до maxThb.
 *
 * @param {Array<Record<string, unknown>>} listings
 * @param {{ binCount?: number, maxThb?: number }} [opts]
 * @returns {number[]}
 */
export function computePriceHistogramBins(listings, opts = {}) {
  const binCount = opts.binCount ?? 14
  const maxThb = opts.maxThb ?? LISTINGS_PRICE_SLIDER_MAX_THB
  const counts = Array(binCount).fill(0)
  for (const l of listings || []) {
    const p = getEffectiveSearchUnitPriceThb(l)
    if (p <= 0 || p > maxThb) continue
    const i = Math.min(binCount - 1, Math.floor((p / maxThb) * binCount))
    counts[i]++
  }
  return counts
}
