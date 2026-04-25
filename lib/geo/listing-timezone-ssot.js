import { getListingDateTimeZone } from '@/lib/listing-date'

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

function isValidIanaTimeZone(value) {
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
 * 1) metadata.timezone (IANA)
 * 2) country/countryCode/country_code fallback map
 * 3) env default LISTING_DATE_TZ / NEXT_PUBLIC_LISTING_DATE_TZ
 */
export function resolveListingTimeZoneFromMetadata(metadata) {
  const meta =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? metadata
      : {}

  if (isValidIanaTimeZone(meta.timezone)) {
    return String(meta.timezone).trim()
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

