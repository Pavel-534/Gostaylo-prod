/**
 * Stage 196.0-A / 200.39 — Guest order location line (seed + geo hierarchy; no raw codes).
 */

import {
  resolveListingLocationPartsSync,
  formatListingLocationLine,
  formatListingLocationLineSync,
} from '@/lib/locations/geo-display-label'
import { CONTACT_REVEALED_BOOKING_STATUSES } from '@/lib/booking/status-sets'
import { normalizeOrderStatus } from '@/lib/orders/order-timeline'

function trimStr(v) {
  if (v == null) return ''
  const s = String(v).trim()
  return s
}

/**
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
 * Sync: metadata + launch-seed labels (no raw geo codes).
 */
export function resolveGuestOrderLocationParts(listing, language = 'ru') {
  const parts = resolveListingLocationPartsSync(listing, language)
  return {
    district: parts.district,
    city: parts.city,
    country: parts.country,
    countryCode: parts.countryCode,
  }
}

/**
 * Async: enrich labels from geo_locations hierarchy.
 */
export async function resolveGuestOrderLocationPartsAsync(listing, language = 'ru') {
  const sync = resolveListingLocationPartsSync(listing, language)
  const line = await formatListingLocationLine({
    countryCode: sync.countryCode,
    regionCode: sync.regionCode,
    cityCode: sync.cityCode,
    district: sync.district,
    cityLabel: sync.cityLabel,
    language,
  })
  return {
    district: sync.district,
    city: sync.cityLabel || sync.city,
    country: sync.countryCode,
    countryCode: sync.countryCode,
    line,
  }
}

export function resolveGuestExactAddress(listing, status) {
  const st = normalizeOrderStatus(status)
  if (!CONTACT_REVEALED_BOOKING_STATUSES.has(st) && st !== 'PAID') return ''
  const row = listing && typeof listing === 'object' ? listing : {}
  const meta =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? row.metadata : {}
  return trimStr(row.address || meta.address || meta.exact_address || meta.street_address)
}

export function formatGuestOrderLocationFromListing(listing, language = 'ru') {
  return formatListingLocationLineSync(listing, language)
}

export async function formatGuestOrderLocationFromListingAsync(listing, language = 'ru') {
  const sync = resolveListingLocationPartsSync(listing, language)
  return formatListingLocationLine({
    countryCode: sync.countryCode,
    regionCode: sync.regionCode,
    cityCode: sync.cityCode,
    district: sync.district,
    cityLabel: sync.cityLabel,
    language,
  })
}
