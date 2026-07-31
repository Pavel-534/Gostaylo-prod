import { getListingDateTimeZone } from '@/lib/listing-date'
import {
  BANGKOK_IANA,
  notifyInvalidListingTimezone,
} from '@/lib/geo/listing-timezone-invalid-alert.js'

const COUNTRY_TZ_MAP = {
  TH: 'Asia/Bangkok',
  RU: 'Europe/Moscow',
  CN: 'Asia/Shanghai',
  US: 'America/New_York',
  GB: 'Europe/London',
  DE: 'Europe/Berlin',
  AU: 'Australia/Sydney',
  JP: 'Asia/Tokyo',
  KR: 'Asia/Seoul',
  SG: 'Asia/Singapore',
  IN: 'Asia/Kolkata',
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
 * 2) country/countryCode/country_code fallback map
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
