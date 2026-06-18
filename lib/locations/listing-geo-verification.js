/**
 * Stage 158.2 — SSOT: verified vs unverified geo on listing write path.
 */

import { COUNTRY_PRESETS } from '@/lib/geo/country-presets'
import { PHUKET_DISTRICTS_CANON } from '@/lib/locations/phuket-districts-canonical'

/**
 * @typedef {'verified' | 'unverified'} GeoStatus
 * @typedef {'district' | 'city'} UnverifiedKind
 *
 * @typedef {object} LocationCapturePayload
 * @property {string} raw_term
 * @property {UnverifiedKind} kind
 * @property {string} [country_code]
 * @property {string} [region_code]
 * @property {string} [city_code]
 *
 * @typedef {object} ListingGeoVerification
 * @property {GeoStatus} geo_status
 * @property {{ raw_term: string, kind: UnverifiedKind, captured_at: string } | null} unverified_location
 * @property {LocationCapturePayload | null} capture
 */

/**
 * @param {string} cityCode
 */
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
 * @param {string} district
 * @param {import('@/lib/locations/resolve-listing-geo-snapshot').ListingGeoSnapshot} snapshot
 */
function isDistrictInCanon(district, snapshot) {
  const d = String(district || '').trim()
  if (!d) return true

  const preset = snapshot.city_code ? findCityPresetByCode(snapshot.city_code) : null
  if (preset?.city.districts?.length) {
    return preset.city.districts.some((x) => x.toLowerCase() === d.toLowerCase())
  }

  if (snapshot.city_code === 'phuket-city') {
    return PHUKET_DISTRICTS_CANON.some((x) => x.toLowerCase() === d.toLowerCase())
  }

  return false
}

/**
 * @param {import('@/lib/locations/resolve-listing-geo-snapshot').ListingGeoSnapshot} snapshot
 * @param {Record<string, unknown>} [context]
 * @returns {ListingGeoVerification}
 */
export function assessListingGeoVerification(snapshot, context = {}) {
  const district = String(snapshot.district || '').trim()
  const metaCity = context.metadataCity ? String(context.metadataCity).trim() : ''
  const hasCascade = Boolean(snapshot.country_code && snapshot.region_code && snapshot.city_code)

  const verifiedBase = /** @type {ListingGeoVerification} */ ({
    geo_status: 'verified',
    unverified_location: null,
    capture: null,
  })

  if (!district && !metaCity) {
    return hasCascade ? verifiedBase : verifiedBase
  }

  if (hasCascade && district && isDistrictInCanon(district, snapshot)) {
    return verifiedBase
  }

  if (hasCascade && !district) {
    return verifiedBase
  }

  let raw_term = district || metaCity
  let kind = /** @type {UnverifiedKind} */ (district ? 'district' : 'city')

  if (!district && metaCity && !hasCascade) {
    raw_term = metaCity
    kind = 'city'
  }

  if (!raw_term) {
    return verifiedBase
  }

  const captured_at = new Date().toISOString()

  return {
    geo_status: 'unverified',
    unverified_location: { raw_term, kind, captured_at },
    capture: {
      raw_term,
      kind,
      country_code: snapshot.country_code || undefined,
      region_code: snapshot.region_code || undefined,
      city_code: snapshot.city_code || undefined,
    },
  }
}
