/**
 * Stage 157 — SSOT write-path geo snapshot (Global Pivot L2).
 */
import { COUNTRY_PRESETS, findCity, findCountry, findRegion } from '@/lib/geo/country-presets'
import {
  PHUKET_DISTRICT_ALIASES,
  PHUKET_DISTRICTS_CANON,
} from '@/lib/locations/phuket-districts-canonical'
import { resolveCanonicalCityLabelForGeo } from '@/lib/locations/city-district-map'

/** Phuket bounding box (approx) for legacy infer. */
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

function findCanonicalInList(districtLower, list) {
  for (const d of list) {
    if (d.toLowerCase() === districtLower) return d
  }
  return null
}

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

  const preset = cityCode ? findCityPresetByCode(cityCode) : null
  if (preset?.city.districts?.length) {
    const hit = findCanonicalInList(lower, preset.city.districts)
    if (hit) return hit
  }

  if (cityCode === 'phuket-city' || isPhuketDistrictName(trimmed)) {
    const phuketHit = findCanonicalInList(lower, [...PHUKET_DISTRICTS_CANON])
    if (phuketHit) return phuketHit
  }

  return trimmed
}

function resolveCascade(countryCode, regionCode, cityCode) {
  const country = findCountry(String(countryCode || '').trim().toUpperCase())
  if (!country) return null
  const region = findRegion(country.code, String(regionCode || '').trim())
  if (!region) return null
  const city = findCity(country.code, region.code, String(cityCode || '').trim())
  if (!city) return null
  return { country, region, city }
}

/**
 * @param {ListingGeoWizardInput} input
 * @returns {ListingGeoSnapshot}
 */
export function resolveListingGeoSnapshot(input = {}) {
  const cascade = resolveCascade(input.countryCode, input.regionCode, input.cityCode)
  const cityCode = cascade?.city?.code || null
  const district = canonicalizeDistrict(input.district, cityCode || undefined)

  const metadataGeo = /** @type {{ city?: string, parent_location?: string }} */ ({})

  if (cascade?.city) {
    const cityLabel = cascade.city.labels?.en || cascade.city.code
    metadataGeo.city = cityLabel
    metadataGeo.parent_location = cityLabel
  } else if (input.existingMetadata?.city) {
    const label = String(input.existingMetadata.city).trim()
    if (label) {
      metadataGeo.city = label
      metadataGeo.parent_location = label
    }
  }

  return {
    country_code: cascade?.country?.code ?? null,
    region_code: cascade?.region?.code ?? null,
    city_code: cascade?.city?.code ?? null,
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
 * @param {{ district?: string|null, metadata?: Record<string, unknown>|null, latitude?: number|null, longitude?: number|null }} row
 * @returns {ListingGeoSnapshot}
 */
export function inferGeoFromLegacyRow(row = {}) {
  const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  const districtRaw = trimDistrict(row.district)
  const districtCanon = canonicalizeDistrict(districtRaw, 'phuket-city')

  if (isPhuketDistrictName(districtCanon) || isInPhuketBbox(row.latitude, row.longitude)) {
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
    const slugAlias = resolveCanonicalCityLabelForGeo(metaCity) || metaCity
    const slugLower = String(slugAlias).toLowerCase().replace(/\s+/g, '-')
    const walk =
      findCityPresetByCode(slugLower) ||
      findCityPresetByCode(metaCity.toLowerCase()) ||
      findCityPresetByCode(
        String(resolveCanonicalCityLabelForGeo(metaCity.toLowerCase()) || '')
          .toLowerCase()
          .replace(/\s+/g, '-'),
      )
    if (walk) {
      return resolveListingGeoSnapshot({
        countryCode: walk.country.code,
        regionCode: walk.region.code,
        cityCode: walk.city.code,
        district: districtCanon || districtRaw,
        existingMetadata: meta,
      })
    }
  }

  return {
    country_code: null,
    region_code: null,
    city_code: null,
    district: districtCanon || districtRaw,
    metadataGeo: metaCity ? { city: metaCity, parent_location: metaCity } : {},
  }
}
