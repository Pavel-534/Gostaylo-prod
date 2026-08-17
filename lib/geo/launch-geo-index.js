/**
 * Stage 200.38 — sync index over LAUNCH_GEO_SEED (offline/write helpers).
 * Runtime SSOT remains geo_locations via GeoService; this is seed mirror only.
 */

import { LAUNCH_GEO_SEED } from '@/lib/geo/launch-markets-seed-data'

/**
 * @typedef {{
 *   code: string
 *   level: string
 *   parent_code: string|null
 *   country_code: string
 *   label_en: string
 *   label_ru?: string
 *   label_th?: string
 *   label_zh?: string
 * }} LaunchGeoNode
 */

/** @type {Map<string, LaunchGeoNode>|null} */
let byCodeCache = null

/**
 * @returns {Map<string, LaunchGeoNode>}
 */
export function getLaunchGeoByCode() {
  if (byCodeCache) return byCodeCache
  /** @type {Map<string, LaunchGeoNode>} */
  const map = new Map()
  for (const row of LAUNCH_GEO_SEED) {
    if (row?.code) map.set(row.code, row)
  }
  byCodeCache = map
  return map
}

/**
 * @param {string} code
 * @returns {LaunchGeoNode|null}
 */
export function findLaunchGeoByCode(code) {
  const c = String(code || '').trim()
  if (!c) return null
  const map = getLaunchGeoByCode()
  return map.get(c) || map.get(c.toLowerCase()) || null
}

/**
 * @param {string} lang
 * @param {LaunchGeoNode|null|undefined} row
 * @param {string} [fallback]
 */
export function launchGeoLabel(lang, row, fallback = '') {
  if (!row) return fallback
  const L = String(lang || 'en').toLowerCase()
  return (
    (L === 'ru' && row.label_ru) ||
    (L === 'th' && row.label_th) ||
    (L === 'zh' && row.label_zh) ||
    row.label_en ||
    row.label_ru ||
    fallback ||
    row.code
  )
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)))
}

const COORD_MATCH_MAX_KM = Object.freeze({
  neighborhood: 6,
  city: 22,
})

/**
 * Snap lat/lng to a curated city/neighborhood centroid.
 * Never invents a market: no match → null (Berlin stays Berlin, not Phuket).
 * @param {number|string|null|undefined} lat
 * @param {number|string|null|undefined} lng
 * @param {{ countryCode?: string|null }} [opts]
 * @returns {LaunchGeoNode|null}
 */
export function matchLaunchGeoByCoords(lat, lng, opts = {}) {
  const a = Number(lat)
  const b = Number(lng)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  const cc = String(opts.countryCode || '')
    .trim()
    .toUpperCase()
    .slice(0, 2)

  let best = null
  let bestScore = Infinity
  for (const row of LAUNCH_GEO_SEED) {
    if (row.level !== 'city' && row.level !== 'neighborhood') continue
    if (cc && String(row.country_code || '').toUpperCase() !== cc) continue
    const lat2 = Number(row.centroid_lat)
    const lon2 = Number(row.centroid_lng)
    if (!Number.isFinite(lat2) || !Number.isFinite(lon2)) continue
    const km = haversineKm(a, b, lat2, lon2)
    const cap = COORD_MATCH_MAX_KM[row.level]
    if (!Number.isFinite(cap) || km > cap) continue
    const score = row.level === 'neighborhood' ? km : km + 0.75
    if (score < bestScore) {
      bestScore = score
      best = row
    }
  }
  return best
}

/**
 * Match ISO country from free-text name using seed country labels.
 * @param {string} nameNorm — already normalized lowercase
 * @returns {string|null}
 */
export function matchLaunchCountryIsoFromName(nameNorm) {
  if (!nameNorm) return null
  for (const row of LAUNCH_GEO_SEED) {
    if (row.level !== 'country') continue
    const labels = [row.label_en, row.label_ru, row.label_th, row.label_zh, row.code]
      .filter(Boolean)
      .map((s) =>
        String(s)
          .toLowerCase()
          .normalize('NFD')
          .replace(/\p{M}/gu, '')
          .trim(),
      )
    if (labels.some((l) => l === nameNorm || (l.length >= 3 && nameNorm.includes(l)))) {
      return row.code
    }
  }
  return null
}

function normLabel(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ё/g, 'е')
    .replace(/[^a-z0-9а-я\s-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Match curated city/region by label (seed mirror — Stage 200.83).
 * @param {string} needle
 * @param {{ countryCode?: string|null, levels?: string[] }} [opts]
 * @returns {LaunchGeoNode|null}
 */
export function matchLaunchGeoByLabel(needle, opts = {}) {
  const n = normLabel(needle)
  if (!n || n.length < 2) return null
  const cc = String(opts.countryCode || '')
    .trim()
    .toUpperCase()
    .slice(0, 2)
  const levels = opts.levels?.length
    ? new Set(opts.levels)
    : new Set(['city', 'neighborhood', 'region'])
  let best = null
  let bestScore = 0
  for (const row of LAUNCH_GEO_SEED) {
    if (!levels.has(row.level)) continue
    if (cc && String(row.country_code || '').toUpperCase() !== cc) continue
    const labels = [row.label_en, row.label_ru, row.label_th, row.label_zh, row.code]
      .filter(Boolean)
      .map(normLabel)
    for (const l of labels) {
      if (!l) continue
      let score = 0
      if (l === n) score = 100
      else if (l.startsWith(n) || n.startsWith(l)) score = 80
      else if (l.includes(n) || n.includes(l)) score = 60
      if (score > bestScore) {
        bestScore = score
        best = row
      }
    }
  }
  return bestScore >= 60 ? best : null
}

/**
 * @param {string} cityCode
 * @returns {{ country_code: string, region_code: string|null, city_code: string }|null}
 */
export function resolveLaunchCityCascade(cityCode) {
  const city = findLaunchGeoByCode(cityCode)
  if (!city || (city.level !== 'city' && city.level !== 'neighborhood')) return null
  let regionCode = city.parent_code || null
  let countryCode = city.country_code || null
  if (city.level === 'neighborhood' && city.parent_code) {
    const parentCity = findLaunchGeoByCode(city.parent_code)
    regionCode = parentCity?.parent_code || regionCode
    countryCode = parentCity?.country_code || countryCode
  }
  if (regionCode) {
    const region = findLaunchGeoByCode(regionCode)
    countryCode = region?.country_code || countryCode
  }
  if (!countryCode) return null
  return {
    country_code: String(countryCode).toUpperCase().slice(0, 2),
    region_code: regionCode,
    city_code: city.level === 'neighborhood' ? city.parent_code || city.code : city.code,
  }
}

/** Test-only */
export function resetLaunchGeoIndexForTests() {
  byCodeCache = null
}
