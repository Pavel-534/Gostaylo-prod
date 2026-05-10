/**
 * Единая «цена за единицу периода» для каталога поиска: при наличии календарного `_pricing`/`pricing`
 * — средняя за ночь/сутки по выбранным датам (как на карточке), иначе `base_price_thb`.
 */

import { LISTINGS_PRICE_SLIDER_MAX_THB } from '@/lib/search/listings-page-url'

/**
 * @param {Record<string, unknown> | null | undefined} listing — строка БД с `_pricing` или DTO с `pricing`
 * @returns {number}
 */
export function getEffectiveSearchUnitPriceThb(listing) {
  if (!listing || typeof listing !== 'object') return 0

  const pr = listing.pricing ?? listing._pricing
  const avg = Number(pr?.averagePerNight ?? pr?.average_per_night)
  if (Number.isFinite(avg) && avg > 0) return avg

  const total = Number(pr?.totalPrice ?? pr?.total_price)
  const nights = Number(pr?.nights)
  if (Number.isFinite(total) && Number.isFinite(nights) && nights > 0) {
    return Math.round(total / nights)
  }

  const base = parseFloat(listing.basePriceThb ?? listing.base_price_thb ?? 0)
  return Number.isFinite(base) && base > 0 ? base : 0
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
