/**
 * Stage 200.37 / 200.39 — listing / place display labels.
 * Async: GeoService. Sync: metadata + launch seed (never invent Phuket; never show raw codes alone).
 */

import { GeoService } from '@/lib/services/geo/geo.service'
import { geoRowLabel } from '@/lib/locations/resolve-where-target'
import { findLaunchGeoByCode, launchGeoLabel } from '@/lib/geo/launch-geo-index'

function looksLikeGeoCode(s) {
  const v = String(s || '').trim()
  if (!v) return false
  if (/^[A-Z]{2}$/i.test(v)) return true
  if (/^[A-Z]{2}-[A-Z0-9]+$/i.test(v)) return true
  if (/^[a-z0-9]+(?:-[a-z0-9]+)+$/i.test(v) && !/\s/.test(v)) return true
  return false
}

/**
 * Format "Patong, Phuket, Thailand" from hierarchy codes + free-text fallbacks.
 * @param {{
 *   countryCode?: string|null
 *   regionCode?: string|null
 *   cityCode?: string|null
 *   district?: string|null
 *   cityLabel?: string|null
 *   language?: string
 * }} input
 * @returns {Promise<string>}
 */
export async function formatListingLocationLine(input = {}) {
  const lang = input.language || 'ru'
  const district = String(input.district || '').trim()
  const cityLabel = String(input.cityLabel || '').trim()
  const cityCode = String(input.cityCode || '').trim()
  const regionCode = String(input.regionCode || '').trim()
  const countryCode = String(input.countryCode || '')
    .trim()
    .toUpperCase()
    .slice(0, 2)

  const parts = []
  if (district && !looksLikeGeoCode(district)) parts.push(district)

  let cityName = cityLabel && !looksLikeGeoCode(cityLabel) ? cityLabel : ''
  if (!cityName && cityCode) {
    const row = await GeoService.getByCode(cityCode)
    cityName = geoRowLabel(row, lang) || ''
    if (!cityName) {
      const seed = findLaunchGeoByCode(cityCode)
      cityName = launchGeoLabel(lang, seed, '')
    }
  }
  if (cityName && !parts.some((p) => p.toLowerCase() === cityName.toLowerCase())) {
    parts.push(cityName)
  }

  let regionName = ''
  if (regionCode) {
    const row = await GeoService.getByCode(regionCode)
    regionName = geoRowLabel(row, lang) || ''
    if (!regionName) {
      const seed = findLaunchGeoByCode(regionCode)
      regionName = launchGeoLabel(lang, seed, '')
    }
    if (
      regionName &&
      !parts.some((p) => p.toLowerCase() === regionName.toLowerCase()) &&
      regionName.toLowerCase() !== String(cityName).toLowerCase()
    ) {
      parts.push(regionName)
    }
  }

  if (countryCode) {
    const row = await GeoService.getByCode(countryCode)
    let countryName = geoRowLabel(row, lang) || ''
    if (!countryName) {
      const seed = findLaunchGeoByCode(countryCode)
      countryName = launchGeoLabel(lang, seed, countryCode)
    }
    if (
      countryName &&
      !parts.some((p) => p.toLowerCase() === countryName.toLowerCase())
    ) {
      parts.push(countryName)
    }
  }

  return parts.join(', ')
}

/**
 * Sync-friendly parts from listing row (metadata first; launch seed for codes).
 */
export function resolveListingLocationPartsSync(listing, language = 'ru') {
  const row = listing && typeof listing === 'object' ? listing : {}
  const meta =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? row.metadata
      : {}

  const district = String(row.district || meta.district || meta.district_label || '').trim()
  const countryCode = String(
    row.country_code || row.countryCode || meta.country_code || meta.countryCode || '',
  )
    .trim()
    .toUpperCase()
    .slice(0, 2)
  const regionCode = String(
    row.region_code || row.regionCode || meta.region_code || meta.regionCode || '',
  ).trim()
  const cityCode = String(
    row.city_code || row.cityCode || meta.city_code || meta.cityCode || '',
  ).trim()
  let cityLabel = String(
    meta.city_label || meta.city || row.city || meta.parent_location || '',
  ).trim()
  if (looksLikeGeoCode(cityLabel)) cityLabel = ''

  const seedCity = cityCode ? findLaunchGeoByCode(cityCode) : null
  const seedRegion = regionCode ? findLaunchGeoByCode(regionCode) : null
  const seedCountry = countryCode ? findLaunchGeoByCode(countryCode) : null

  const city =
    cityLabel ||
    launchGeoLabel(language, seedCity, '') ||
    ''
  const region = launchGeoLabel(language, seedRegion, '') || ''
  const country = launchGeoLabel(language, seedCountry, countryCode || '') || ''

  return {
    district: looksLikeGeoCode(district) ? '' : district,
    city,
    country,
    countryCode,
    regionCode,
    cityCode,
    cityLabel: cityLabel || city,
    regionLabel: region,
  }
}

/**
 * Sync display line for cards / order headers (browser-safe).
 * @param {object} listing
 * @param {string} [language]
 */
export function formatListingLocationLineSync(listing, language = 'ru') {
  const parts = resolveListingLocationPartsSync(listing, language)
  const out = []
  if (parts.district) out.push(parts.district)
  if (parts.city && !out.some((p) => p.toLowerCase() === parts.city.toLowerCase())) {
    out.push(parts.city)
  }
  if (
    parts.regionLabel &&
    !out.some((p) => p.toLowerCase() === parts.regionLabel.toLowerCase()) &&
    parts.regionLabel.toLowerCase() !== String(parts.city).toLowerCase()
  ) {
    // Prefer city over region when both present for short card line — skip region if city exists
    if (!parts.city) out.push(parts.regionLabel)
  }
  if (
    parts.country &&
    !out.some((p) => p.toLowerCase() === parts.country.toLowerCase())
  ) {
    out.push(parts.country)
  }
  return out.join(', ')
}
