/**
 * Stage 200.37 / 200.39 / 201.93 — listing / place display labels.
 * Guest cards: Area + City + Country in UI language; English fallback; never dump OSM Thai on RU UI.
 * Async: GeoService. Sync: metadata + launch seed (never invent Phuket; never show raw codes alone).
 */

import { GeoService } from '@/lib/services/geo/geo.service'
import { geoRowLabel } from '@/lib/locations/resolve-where-target'
import {
  findLaunchGeoByCode,
  getLaunchGeoByCode,
  launchGeoLabel,
  matchLaunchGeoByCoords,
  resolveLaunchCityCascade,
} from '@/lib/geo/launch-geo-index'
import { getIsoCountryLabel } from '@/lib/geo/iso-countries-catalog'

function looksLikeGeoCode(s) {
  const v = String(s || '').trim()
  if (!v) return false
  if (/^[A-Z]{2}$/i.test(v)) return true
  if (/^[A-Z]{2}-[A-Z0-9]+$/i.test(v)) return true
  if (/^[a-z0-9]+(?:-[a-z0-9]+)+$/i.test(v) && !/\s/.test(v)) return true
  return false
}

function uiLang(lang) {
  return String(lang || 'en').toLowerCase().slice(0, 2)
}

/**
 * Latin toponyms are the international fallback. Other scripts only when they match UI lang.
 * @param {string} text
 * @param {string} [lang]
 */
export function placeTokenFitsUiLanguage(text, lang = 'en') {
  const s = String(text || '').trim()
  if (!s || looksLikeGeoCode(s)) return false
  const L = uiLang(lang)
  const hasThai = /[\u0E00-\u0E7F]/.test(s)
  const hasCyrillic = /[\u0400-\u04FF]/.test(s)
  const hasHan = /[\u3400-\u9FFF]/.test(s)
  const hasArabic = /[\u0600-\u06FF]/.test(s)
  if (hasThai && L !== 'th') return false
  if (hasHan && L !== 'zh') return false
  if (hasArabic) return false
  if (hasCyrillic && L !== 'ru') return false
  return true
}

function launchPlaceLabels(row) {
  return [row.label_en, row.label_ru, row.label_th, row.label_zh].filter(Boolean).map((lab) =>
    String(lab).trim(),
  )
}

function findLaunchGeoByExactLabel(text) {
  const n = String(text || '').trim().toLowerCase()
  if (!n) return null
  for (const row of getLaunchGeoByCode().values()) {
    if (row.level !== 'city' && row.level !== 'neighborhood' && row.level !== 'country') continue
    for (const lab of launchPlaceLabels(row)) {
      if (lab.toLowerCase() === n) return row
    }
  }
  return null
}

/** OSM blobs like «บ้านกะรน» often wrap a seed neighborhood name. */
function findLaunchGeoByContainedLabel(text) {
  const raw = String(text || '').trim()
  const n = raw.toLowerCase()
  if (n.length < 4) return null
  const tokens = n.split(/[\s,./_-]+/).filter((t) => t.length >= 4)
  let hit = null
  for (const row of getLaunchGeoByCode().values()) {
    if (row.level !== 'city' && row.level !== 'neighborhood') continue
    for (const lab of launchPlaceLabels(row)) {
      const l = lab.toLowerCase()
      if (l.length < 4) continue
      const latin = /[a-z]/.test(l)
      const matched = latin
        ? tokens.includes(l) || n === l
        : n.includes(l) || (l.length >= 4 && l.includes(n))
      if (!matched) continue
      if (hit && hit.code !== row.code) return null
      hit = row
    }
  }
  return hit
}

/**
 * Localize a free-text OSM/partner token via launch seed; else keep if script-safe.
 * @param {string} text
 * @param {string} [lang]
 * @returns {string}
 */
export function sanitizePlaceToken(text, lang = 'en') {
  const raw = String(text || '').trim()
  if (!raw || looksLikeGeoCode(raw)) return ''
  const seed = findLaunchGeoByExactLabel(raw) || findLaunchGeoByContainedLabel(raw)
  if (seed) return launchGeoLabel(lang, seed, '') || ''
  return placeTokenFitsUiLanguage(raw, lang) ? raw : ''
}

function pushUniquePlace(out, token, lang) {
  const t = sanitizePlaceToken(token, lang)
  if (!t) return
  if (out.some((p) => p.toLowerCase() === t.toLowerCase())) return
  out.push(t)
}

/**
 * Split comma-joined OSM blobs ("Patong, Patong") and drop script-mismatched pieces.
 * @param {string[]} parts
 * @param {string} [lang]
 * @returns {string[]}
 */
export function collapsePlaceLineParts(parts, lang = 'en') {
  const out = []
  for (const raw of parts) {
    for (const piece of String(raw || '').split(',')) {
      pushUniquePlace(out, piece, lang)
    }
  }
  return out
}

function localizedNameFromCode(code, lang) {
  const seed = findLaunchGeoByCode(code)
  const fromSeed = launchGeoLabel(lang, seed, '')
  if (fromSeed && !looksLikeGeoCode(fromSeed)) return fromSeed
  return ''
}

function joinCardPlaceLine({ area, city, region, country, lang }) {
  return collapsePlaceLineParts([area, city, region, country], lang).join(', ')
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

  let cityName = localizedNameFromCode(cityCode, lang)
  if (!cityName && cityCode) {
    const row = await GeoService.getByCode(cityCode)
    cityName = geoRowLabel(row, lang) || ''
  }
  if (!cityName) cityName = sanitizePlaceToken(cityLabel, lang)

  let regionName = localizedNameFromCode(regionCode, lang)
  if (!regionName && regionCode) {
    const row = await GeoService.getByCode(regionCode)
    regionName = geoRowLabel(row, lang) || ''
  }

  let countryName = localizedNameFromCode(countryCode, lang)
  if (!countryName && countryCode) {
    const row = await GeoService.getByCode(countryCode)
    countryName = geoRowLabel(row, lang) || ''
  }
  if (!countryName) {
    countryName = getIsoCountryLabel(countryCode, lang) || ''
  }
  if (looksLikeGeoCode(countryName)) countryName = ''

  return joinCardPlaceLine({
    area: district,
    city: cityName,
    region: cityName ? '' : regionName,
    country: countryName,
    lang,
  })
}

/**
 * Sync-friendly parts from listing row (codes + seed first; OSM text only if script-safe).
 */
export function resolveListingLocationPartsSync(listing, language = 'ru') {
  const row = listing && typeof listing === 'object' ? listing : {}
  const meta =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? row.metadata
      : {}

  const districtRaw = String(row.district || meta.district || meta.district_label || '').trim()
  let cityCode = String(
    row.city_code || row.cityCode || meta.city_code || meta.cityCode || '',
  ).trim()
  let regionCode = String(
    row.region_code || row.regionCode || meta.region_code || meta.regionCode || '',
  ).trim()
  let countryCode = String(
    row.country_code || row.countryCode || meta.country_code || meta.countryCode || '',
  )
    .trim()
    .toUpperCase()
    .slice(0, 2)

  const lat = Number(row.latitude ?? row.lat)
  const lng = Number(row.longitude ?? row.lng ?? row.lon)
  const place = matchLaunchGeoByCoords(lat, lng, { countryCode })
  if (place) {
    const cascade = resolveLaunchCityCascade(place.code)
    if (cascade) {
      if (!cityCode) cityCode = cascade.city_code || cityCode
      if (!regionCode) regionCode = cascade.region_code || ''
      if (!countryCode) countryCode = cascade.country_code
    }
  }

  if (!countryCode && cityCode) {
    countryCode = String(findLaunchGeoByCode(cityCode)?.country_code || '')
      .trim()
      .toUpperCase()
      .slice(0, 2)
  }
  if (!countryCode && regionCode) {
    countryCode = String(findLaunchGeoByCode(regionCode)?.country_code || '')
      .trim()
      .toUpperCase()
      .slice(0, 2)
  }
  let cityLabel = String(
    meta.city_label || meta.city || row.city || meta.parent_location || '',
  ).trim()
  if (looksLikeGeoCode(cityLabel)) cityLabel = ''

  const seedCityName = localizedNameFromCode(cityCode, language)
  const city = seedCityName || sanitizePlaceToken(cityLabel, language)
  const region = localizedNameFromCode(regionCode, language)
  const countryRaw =
    localizedNameFromCode(countryCode, language) ||
    getIsoCountryLabel(countryCode, language) ||
    ''
  const country = looksLikeGeoCode(countryRaw) ? '' : countryRaw
  let district = sanitizePlaceToken(districtRaw, language)
  if (!district && place?.level === 'neighborhood') {
    district = launchGeoLabel(language, place, '') || ''
  }

  return {
    district,
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
 * Fetch `/api/v2/geo/listing-label` only when codes exist but seed/sync city is empty
 * (provisional / non-launch). Catalog grids must not N+1 when launch seed already labels the city.
 */
export function listingLocationNeedsGeoEnrichment(listing, language = 'ru') {
  const parts = resolveListingLocationPartsSync(listing, language)
  if (!parts.cityCode && !parts.regionCode) return false
  return !parts.city
}

/**
 * Sync display line for cards / order headers (browser-safe).
 * Airbnb-style: area, city, country — UI lang, else English / Latin toponym.
 * @param {object} listing
 * @param {string} [language]
 */
export function formatListingLocationLineSync(listing, language = 'ru') {
  const parts = resolveListingLocationPartsSync(listing, language)
  return joinCardPlaceLine({
    area: parts.district,
    city: parts.city,
    region: parts.city ? '' : parts.regionLabel,
    country: parts.country,
    lang: language,
  })
}
