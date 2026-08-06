/**
 * Stage 200.44 — offline lat/lon → IANA timezone (no network).
 * Uses `tz-lookup` (geo-tz v8 mis-maps Thailand hubs to Asia/Jakarta).
 */

import tzLookup from 'tz-lookup'
import { COUNTRY_CURRENCY_TZ } from '@/lib/geo/launch-markets-seed-data'
import {
  defaultTimezoneForCountryCode,
  isValidIanaTimeZone,
} from '@/lib/geo/listing-timezone-ssot'

/**
 * Coarse IANA guess from map pin (offline polygon lookup).
 * @param {number|null|undefined} lat
 * @param {number|null|undefined} lon
 * @returns {string} IANA id or empty string if coords invalid
 */
export function guessIanaTimezoneFromLatLon(lat, lon) {
  if (lat == null || lon == null || lat === '' || lon === '') return ''
  const a = Number(lat)
  const b = Number(lon)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return ''
  if (a < -90 || a > 90 || b < -180 || b > 180) return ''
  try {
    const tz = tzLookup(a, b)
    return tz && isValidIanaTimeZone(tz) ? tz : ''
  } catch {
    return ''
  }
}

/**
 * Resolve listing place timezone for wizard write path.
 * Priority (Stage 200.44):
 * 1) valid lat/lon → offline IANA (tz-lookup)
 * 2) city / region timezone from geo_locations (when no pin yet)
 * 3) country default (launch map / COUNTRY_TZ_MAP)
 * 4) Asia/Bangkok
 *
 * Currency remains country-scoped elsewhere — not here.
 *
 * @param {{
 *   lat?: number|null,
 *   lon?: number|null,
 *   cityTimezone?: string|null,
 *   regionTimezone?: string|null,
 *   countryCode?: string|null,
 *   explicitTimezone?: string|null,
 * }} [opts]
 * @returns {string}
 */
export function resolveListingPlaceTimezone(opts = {}) {
  const fromPin = guessIanaTimezoneFromLatLon(opts.lat, opts.lon)
  if (fromPin) return fromPin

  const cityTz = String(opts.cityTimezone || '').trim()
  if (cityTz && isValidIanaTimeZone(cityTz)) return cityTz

  const regionTz = String(opts.regionTimezone || '').trim()
  if (regionTz && isValidIanaTimeZone(regionTz)) return regionTz

  // explicitTimezone is last among place hints: often country-row TZ from reverse
  // and must not override pin (already handled) or catalog city/region.
  const explicit = String(opts.explicitTimezone || '').trim()
  if (explicit && isValidIanaTimeZone(explicit)) return explicit

  const iso = String(opts.countryCode || '')
    .trim()
    .toUpperCase()
    .slice(0, 2)
  const fromCountry =
    (iso && COUNTRY_CURRENCY_TZ[iso]?.timezone) ||
    defaultTimezoneForCountryCode(iso) ||
    ''
  if (fromCountry && isValidIanaTimeZone(fromCountry)) return fromCountry

  return 'Asia/Bangkok'
}
