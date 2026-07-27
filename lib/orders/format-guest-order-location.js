/**
 * Stage 196.0-A — Guest order location line SSOT (no hard-coded country).
 */

import { findCity, findCountry, findRegion, getLabel } from '@/lib/geo/country-presets'
import { CONTACT_REVEALED_BOOKING_STATUSES } from '@/lib/booking/status-sets'
import { normalizeOrderStatus } from '@/lib/orders/order-timeline'

function trimStr(v) {
  if (v == null) return ''
  const s = String(v).trim()
  return s
}

/**
 * Build "district, city, country" from available parts. Missing country/city → omit (never invent).
 * @param {{ district?: string|null, city?: string|null, country?: string|null, language?: string }} args
 * @returns {string}
 */
export function formatGuestOrderLocation({ district, city, country, language: _language = 'ru' } = {}) {
  const d = trimStr(district)
  const c = trimStr(city)
  const co = trimStr(country)
  const parts = []
  if (d) parts.push(d)
  if (c && c.toLowerCase() !== d.toLowerCase()) parts.push(c)
  if (co && co.toLowerCase() !== c.toLowerCase() && co.toLowerCase() !== d.toLowerCase()) {
    parts.push(co)
  }
  return parts.join(', ')
}

/**
 * Resolve human-readable city/country labels from listing geo codes + free-text fields.
 * @param {object|null|undefined} listing
 * @param {string} [language='ru']
 */
export function resolveGuestOrderLocationParts(listing, language = 'ru') {
  const row = listing && typeof listing === 'object' ? listing : {}
  const meta =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? row.metadata : {}

  const district = trimStr(row.district || meta.district || meta.district_label)
  const countryCode = trimStr(row.country_code || row.countryCode || meta.country_code || meta.countryCode)
  const regionCode = trimStr(row.region_code || row.regionCode || meta.region_code || meta.regionCode)
  const cityCode = trimStr(row.city_code || row.cityCode || meta.city_code || meta.cityCode)

  let city = trimStr(row.city || meta.city || meta.city_label || meta.parent_location)
  if (!city && countryCode && regionCode && cityCode) {
    city = getLabel(findCity(countryCode, regionCode, cityCode), language)
  }
  if (!city && countryCode && regionCode) {
    city = getLabel(findRegion(countryCode, regionCode), language)
  }

  let country = trimStr(row.country || meta.country || meta.country_label)
  if (!country && countryCode) {
    country = getLabel(findCountry(countryCode), language)
  }

  return { district, city, country, countryCode }
}

/**
 * Exact street address for fulfillment — only after payment/reveal statuses.
 * @param {object|null|undefined} listing
 * @param {string|null|undefined} status
 * @returns {string}
 */
export function resolveGuestExactAddress(listing, status) {
  const st = normalizeOrderStatus(status)
  if (!CONTACT_REVEALED_BOOKING_STATUSES.has(st) && st !== 'PAID') return ''
  const row = listing && typeof listing === 'object' ? listing : {}
  const meta =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? row.metadata : {}
  return trimStr(row.address || meta.address || meta.exact_address || meta.street_address)
}

/**
 * Soft location for order header (district/city/country — never invent country).
 * @param {object|null|undefined} listing
 * @param {string} [language='ru']
 */
export function formatGuestOrderLocationFromListing(listing, language = 'ru') {
  const parts = resolveGuestOrderLocationParts(listing, language)
  return formatGuestOrderLocation({ ...parts, language })
}
