import { getListingDateTimeZone } from '@/lib/listing-date'
import {
  BANGKOK_IANA,
  notifyInvalidListingTimezone,
} from '@/lib/geo/listing-timezone-invalid-alert.js'

/** Country capital/default TZ (last resort when no pin). Stage 200.47 expands majors. */
export const COUNTRY_TZ_MAP = {
  TH: 'Asia/Bangkok',
  RU: 'Europe/Moscow',
  CN: 'Asia/Shanghai',
  HK: 'Asia/Hong_Kong',
  US: 'America/New_York',
  GB: 'Europe/London',
  DE: 'Europe/Berlin',
  FR: 'Europe/Paris',
  IT: 'Europe/Rome',
  ES: 'Europe/Madrid',
  NL: 'Europe/Amsterdam',
  AT: 'Europe/Vienna',
  BE: 'Europe/Brussels',
  PT: 'Europe/Lisbon',
  IE: 'Europe/Dublin',
  FI: 'Europe/Helsinki',
  GR: 'Europe/Athens',
  AU: 'Australia/Sydney',
  NZ: 'Pacific/Auckland',
  JP: 'Asia/Tokyo',
  KR: 'Asia/Seoul',
  SG: 'Asia/Singapore',
  MY: 'Asia/Kuala_Lumpur',
  IN: 'Asia/Kolkata',
  TR: 'Europe/Istanbul',
  ID: 'Asia/Jakarta',
  AE: 'Asia/Dubai',
  CA: 'America/Toronto',
}

/**
 * Default IANA timezone for wizard country cascade (ISO alpha-2).
 * @param {string | null | undefined} countryCode
 * @returns {string | null}
 */
export function defaultTimezoneForCountryCode(countryCode) {
  const code = String(countryCode || '')
    .trim()
    .slice(0, 2)
    .toUpperCase()
  return code && COUNTRY_TZ_MAP[code] ? COUNTRY_TZ_MAP[code] : null
}

export function isValidIanaTimeZone(value) {
  const tz = String(value || '').trim()
  if (!tz) return false
  try {
    Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date())
    return true
  } catch {
    return false
  }
}

/**
 * Resolve listing timezone from metadata (SSOT for JS + SQL callers).
 * Priority:
 * 1) metadata.timezone (IANA) — invalid → alert + Asia/Bangkok (AUDIT_03 W3.8)
 * 2) country/countryCode/country_code fallback map (last resort — multi-TZ countries
 *    must store place TZ in metadata; wizard write path: Stage 200.44 pin/city first)
 * 3) env default LISTING_DATE_TZ / NEXT_PUBLIC_LISTING_DATE_TZ
 *
 * @param {object | null | undefined} metadata
 * @param {{ listingId?: string | null }} [opts]
 */
export function resolveListingTimeZoneFromMetadata(metadata, opts = {}) {
  const meta =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? metadata
      : {}

  const rawTz = meta.timezone
  if (rawTz != null && String(rawTz).trim() !== '') {
    if (isValidIanaTimeZone(rawTz)) {
      return String(rawTz).trim()
    }
    notifyInvalidListingTimezone(opts.listingId ?? meta.listing_id ?? meta.listingId, rawTz)
    return BANGKOK_IANA
  }

  const countryRaw =
    meta.country_code ??
    meta.countryCode ??
    meta.country ??
    meta.region_country ??
    ''
  const countryCode = String(countryRaw || '').trim().slice(0, 2).toUpperCase()
  if (countryCode && COUNTRY_TZ_MAP[countryCode]) {
    return COUNTRY_TZ_MAP[countryCode]
  }

  return getListingDateTimeZone()
}
