/**
 * ADR-181.2 — SSOT: listing geo → asset currency (L1).
 * RU market: hard invariant → RUB on server write-path.
 *
 * @see docs/ADR/181-listing-asset-currency-ssot.md §2.3
 */

import { COUNTRY_PRESETS } from '@/lib/geo/country-presets'
import { isListingBaseCurrency, normalizeCurrencyCode } from '@/lib/finance/currency-codes'

/** @type {Readonly<Record<string, string>>} */
export const COUNTRY_LISTING_BASE_CURRENCY = Object.freeze({
  RU: 'RUB',
  TH: 'THB',
  US: 'USD',
  AE: 'USD',
  TR: 'USD',
  ID: 'USD',
})

const RUSSIA_COUNTRY = 'RU'
const RUSSIA_REGION_PREFIX = 'RU-'

function findCityPresetByCode(cityCode) {
  const code = String(cityCode || '').trim()
  if (!code) return null
  for (const country of COUNTRY_PRESETS) {
    for (const region of country.regions) {
      const city = region.cities.find((ci) => ci.code === code)
      if (city) return { country, region, city }
    }
  }
  return null
}

/**
 * @param {string | null | undefined} countryCode ISO-3166-1 alpha-2
 * @returns {string}
 */
export function getDefaultListingBaseCurrency(countryCode) {
  const cc = String(countryCode || '').trim().toUpperCase().slice(0, 2)
  const mapped = COUNTRY_LISTING_BASE_CURRENCY[cc]
  if (mapped && isListingBaseCurrency(mapped)) return mapped
  return 'THB'
}

/**
 * @param {{
 *   countryCode?: string | null,
 *   regionCode?: string | null,
 *   cityCode?: string | null,
 * }} geo
 */
export function isRussiaListingGeo(geo = {}) {
  const country = String(geo.countryCode || '').trim().toUpperCase().slice(0, 2)
  if (country === RUSSIA_COUNTRY) return true

  const region = String(geo.regionCode || '').trim().toUpperCase()
  if (region.startsWith(RUSSIA_REGION_PREFIX)) return true

  const cityCode = String(geo.cityCode || '').trim()
  if (cityCode) {
    const preset = findCityPresetByCode(cityCode)
    if (preset?.country?.code === RUSSIA_COUNTRY) return true
  }

  return false
}

/**
 * @param {{
 *   countryCode?: string | null,
 *   regionCode?: string | null,
 *   cityCode?: string | null,
 *   requestedCurrency?: string | null,
 * }} params
 * @returns {{
 *   baseCurrency: string,
 *   source: 'ru_geo_invariant' | 'country_map' | 'request' | 'fallback_thb',
 *   overridden: boolean,
 * }}
 */
export function resolveEnforcedListingBaseCurrency(params = {}) {
  const requested = normalizeCurrencyCode(params.requestedCurrency || 'THB', 'THB')

  if (isRussiaListingGeo(params)) {
    return {
      baseCurrency: 'RUB',
      source: 'ru_geo_invariant',
      overridden: requested !== 'RUB',
    }
  }

  const cc = String(params.countryCode || '').trim().toUpperCase().slice(0, 2)
  if (cc) {
    const mapped = getDefaultListingBaseCurrency(cc)
    return {
      baseCurrency: mapped,
      source: 'country_map',
      overridden: requested !== mapped,
    }
  }

  if (isListingBaseCurrency(requested)) {
    return { baseCurrency: requested, source: 'request', overridden: false }
  }

  return { baseCurrency: 'THB', source: 'fallback_thb', overridden: requested !== 'THB' }
}

/** Opt-out: `LISTING_BASE_CURRENCY_AUTO=0` */
export function isListingBaseCurrencyAutoEnabled() {
  return String(process.env.LISTING_BASE_CURRENCY_AUTO ?? '1').trim() !== '0'
}
