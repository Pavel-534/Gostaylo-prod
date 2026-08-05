/**
 * Stage 157 / 200.38 — listing write-path geo snapshot (codes + metadata; no country-presets).
 */

import {
  PHUKET_DISTRICT_ALIASES,
  PHUKET_DISTRICTS_CANON,
} from '@/lib/locations/phuket-districts-canonical'
import {
  findLaunchGeoByCode,
  launchGeoLabel,
  resolveLaunchCityCascade,
} from '@/lib/geo/launch-geo-index'
import { resolveCanonicalCityLabelForGeoSync } from '@/lib/locations/city-district-map'
import { resolveWhereSlugAlias } from '@/lib/locations/where-slug-aliases'

/** Approximate Phuket bbox for legacy backfill only. */
const PHUKET_LAT_MIN = 7.75
const PHUKET_LAT_MAX = 8.25
const PHUKET_LON_MIN = 98.25
const PHUKET_LON_MAX = 98.55

/**
 * @typedef {Object} ListingGeoWizardInput
 * @property {string} [countryCode]
 * @property {string} [regionCode]
 * @property {string} [cityCode]
 * @property {string} [district]
 * @property {number|null} [latitude]
 * @property {number|null} [longitude]
 * @property {Record<string, unknown>} [existingMetadata]
 */

/**
 * @typedef {Object} ListingGeoSnapshot
 * @property {string|null} country_code
 * @property {string|null} region_code
 * @property {string|null} city_code
 * @property {string} district
 * @property {{ city?: string, parent_location?: string }} metadataGeo
 */

function trimDistrict(raw) {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 100)
}

function isPhuketDistrictName(name) {
  const lower = trimDistrict(name).toLowerCase()
  if (!lower) return false
  if (PHUKET_DISTRICT_ALIASES[lower]) return true
  return PHUKET_DISTRICTS_CANON.some((d) => d.toLowerCase() === lower)
}

/**
 * @param {string} districtRaw
 * @param {string} [cityCode]
 * @returns {string}
 */
export function canonicalizeDistrict(districtRaw, cityCode = '') {
  const trimmed = trimDistrict(districtRaw)
  if (!trimmed) return ''

  const lower = trimmed.toLowerCase()
  if (PHUKET_DISTRICT_ALIASES[lower]) {
    return PHUKET_DISTRICT_ALIASES[lower]
  }

  if (cityCode === 'phuket-city' || isPhuketDistrictName(trimmed)) {
    const hit = PHUKET_DISTRICTS_CANON.find((d) => d.toLowerCase() === lower)
    if (hit) return hit
  }

  return trimmed
}

/**
 * @param {ListingGeoWizardInput} input
 * @returns {ListingGeoSnapshot}
 */
export function resolveListingGeoSnapshot(input = {}) {
  const cc = String(input.countryCode || '')
    .trim()
    .toUpperCase()
    .slice(0, 2)
  let rc = String(input.regionCode || '').trim() || null
  let cic = String(input.cityCode || '').trim() || null

  // Fill missing parents from launch seed when only city code is known
  if (cic && (!cc || !rc)) {
    const cascade = resolveLaunchCityCascade(cic)
    if (cascade) {
      if (!cc) Object.assign(input, { countryCode: cascade.country_code })
      if (!rc) rc = cascade.region_code
      cic = cascade.city_code
    }
  }

  const countryCode = String(input.countryCode || cc || '')
    .trim()
    .toUpperCase()
    .slice(0, 2)
  const district = canonicalizeDistrict(input.district, cic || undefined)
  const meta =
    input.existingMetadata && typeof input.existingMetadata === 'object'
      ? input.existingMetadata
      : {}

  const seedCity = cic ? findLaunchGeoByCode(cic) : null
  const cityLabel =
    String(meta.city_label || meta.city || '').trim() ||
    (seedCity ? launchGeoLabel('en', seedCity, cic) : '') ||
    (cic || '')

  /** @type {{ city?: string, parent_location?: string }} */
  const metadataGeo = {}
  if (cityLabel) {
    metadataGeo.city = cityLabel
    metadataGeo.parent_location = cityLabel
  }

  if (/^[A-Z]{2}$/.test(countryCode)) {
    return {
      country_code: countryCode,
      region_code: rc,
      city_code: cic,
      district,
      metadataGeo,
    }
  }

  return {
    country_code: null,
    region_code: null,
    city_code: null,
    district,
    metadataGeo,
  }
}

function isInPhuketBbox(lat, lon) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= PHUKET_LAT_MIN &&
    lat <= PHUKET_LAT_MAX &&
    lon >= PHUKET_LON_MIN &&
    lon <= PHUKET_LON_MAX
  )
}

/**
 * Lightweight legacy infer for backfill scripts (no country-presets walk).
 * @param {{ district?: string|null, metadata?: Record<string, unknown>|null, latitude?: number|null, longitude?: number|null }} row
 * @returns {ListingGeoSnapshot}
 */
export function inferGeoFromLegacyRow(row = {}) {
  const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  const districtRaw = trimDistrict(row.district)
  const districtCanon = canonicalizeDistrict(districtRaw)

  if (isPhuketDistrictName(districtCanon)) {
    return resolveListingGeoSnapshot({
      countryCode: 'TH',
      regionCode: 'TH-PHK',
      cityCode: 'phuket-city',
      district: districtCanon || districtRaw,
      existingMetadata: meta,
    })
  }

  // Bbox alone is not enough (Stage 200.39) — avoid forcing Phuket on ambiguous coords
  if (isInPhuketBbox(row.latitude, row.longitude) && districtCanon) {
    return resolveListingGeoSnapshot({
      countryCode: 'TH',
      regionCode: 'TH-PHK',
      cityCode: 'phuket-city',
      district: districtCanon || districtRaw,
      existingMetadata: meta,
    })
  }

  const metaCity = meta.city ? String(meta.city).trim() : ''
  if (metaCity) {
    const aliased =
      resolveWhereSlugAlias(metaCity) ||
      resolveCanonicalCityLabelForGeoSync(metaCity) ||
      metaCity
    const slug = String(aliased)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
    const cascade = resolveLaunchCityCascade(slug) || resolveLaunchCityCascade(aliased)
    if (cascade) {
      return resolveListingGeoSnapshot({
        countryCode: cascade.country_code,
        regionCode: cascade.region_code,
        cityCode: cascade.city_code,
        district: districtCanon || districtRaw,
        existingMetadata: meta,
      })
    }
  }

  const existingCc = String(meta.country_code || '').trim().toUpperCase().slice(0, 2)
  if (/^[A-Z]{2}$/.test(existingCc)) {
    return resolveListingGeoSnapshot({
      countryCode: existingCc,
      regionCode: meta.region_code,
      cityCode: meta.city_code,
      district: districtCanon || districtRaw,
      existingMetadata: meta,
    })
  }

  return {
    country_code: null,
    region_code: null,
    city_code: null,
    district: districtCanon || districtRaw,
    metadataGeo: metaCity ? { city: metaCity, parent_location: metaCity } : {},
  }
}
