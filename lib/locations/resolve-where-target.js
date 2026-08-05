/**
 * Stage 200.37 — DB-first where-target resolve (geo_locations + geo_synonyms).
 * No country-presets. No silent city coerce.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { resolveWhereSlugAlias } from '@/lib/locations/where-slug-aliases'
import { GeoService } from '@/lib/services/geo/geo.service'

/**
 * @typedef {object} WhereTarget
 * @property {'country'|'region'|'city'|'neighborhood'} level
 * @property {string} countryCode
 * @property {string} [regionCode]
 * @property {string} [cityCode]
 * @property {string[]} [regions]
 * @property {string[]} [cities]
 * @property {string[]} [districts] — child labels for umbrella ILIKE/eq
 * @property {string} [label]
 * @property {number|null} [centroidLat]
 * @property {number|null} [centroidLng]
 * @property {number} [mapZoom]
 */

function labelOf(row, lang = 'en') {
  if (!row) return ''
  const L = ['ru', 'en', 'zh', 'th'].includes(lang) ? lang : 'en'
  return (
    (L === 'ru' && row.label_ru) ||
    (L === 'th' && row.label_th) ||
    (L === 'zh' && row.label_zh) ||
    row.label_en ||
    row.label_ru ||
    row.code ||
    ''
  )
}

function zoomForLevel(level) {
  if (level === 'country') return 6
  if (level === 'region') return 8
  if (level === 'city' || level === 'neighborhood') return 12
  return 10
}

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
}

/**
 * Expand city/region children for search OR (umbrella).
 * @param {string} parentCode
 * @param {'city'|'neighborhood'|null} childLevel
 */
async function loadChildCodesAndDistrictLabels(parentCode, childLevel = null) {
  if (!supabaseAdmin || !parentCode) return { cities: [], districts: [], regions: [] }
  let q = supabaseAdmin
    .from('geo_locations')
    .select('code,level,label_en,label_ru,parent_code')
    .eq('parent_code', parentCode)
    .eq('is_active', true)
    .limit(200)
  if (childLevel) q = q.eq('level', childLevel)
  const { data } = await q
  const cities = []
  const districts = []
  const regions = []
  for (const row of data || []) {
    if (row.level === 'region') regions.push(row.code)
    if (row.level === 'city' || row.level === 'neighborhood') {
      cities.push(row.code)
      const en = row.label_en
      const ru = row.label_ru
      if (en) districts.push(en)
      if (ru && ru !== en) districts.push(ru)
    }
  }
  return { cities, districts, regions }
}

/**
 * Build WhereTarget from a geo_locations row (+ hierarchy extras).
 * @param {object} row
 * @param {string} [lang]
 * @returns {Promise<WhereTarget|null>}
 */
async function targetFromRow(row, lang = 'en') {
  if (!row?.code) return null
  const level = row.level === 'neighborhood' ? 'neighborhood' : row.level
  const countryCode = String(row.country_code || row.iso_country || (level === 'country' ? row.code : ''))
    .toUpperCase()
    .slice(0, 2)

  const base = {
    label: labelOf(row, lang),
    centroidLat: row.centroid_lat != null ? Number(row.centroid_lat) : null,
    centroidLng: row.centroid_lng != null ? Number(row.centroid_lng) : null,
    mapZoom: zoomForLevel(level),
  }

  if (level === 'country') {
    const kids = await loadChildCodesAndDistrictLabels(row.code)
    // also regions' cities
    const allCities = [...kids.cities]
    const allDistricts = [...kids.districts]
    for (const rc of kids.regions) {
      const nested = await loadChildCodesAndDistrictLabels(rc)
      allCities.push(...nested.cities)
      allDistricts.push(...nested.districts)
    }
    return {
      level: 'country',
      countryCode: row.code,
      regions: kids.regions,
      cities: Array.from(new Set(allCities)),
      districts: Array.from(new Set(allDistricts)),
      ...base,
    }
  }

  if (level === 'region') {
    const kids = await loadChildCodesAndDistrictLabels(row.code)
    return {
      level: 'region',
      countryCode: countryCode || String(row.parent_code || '').slice(0, 2),
      regionCode: row.code,
      cities: kids.cities,
      districts: kids.districts,
      ...base,
    }
  }

  // city or neighborhood
  let regionCode = row.parent_code || null
  let cityCode = row.code
  if (level === 'neighborhood' && row.parent_code) {
    cityCode = row.parent_code
    const parent = await GeoService.getByCode(row.parent_code)
    regionCode = parent?.parent_code || regionCode
  }
  const kids = await loadChildCodesAndDistrictLabels(cityCode, 'neighborhood')
  // Also include city own labels as district umbrella terms
  const districts = Array.from(
    new Set(
      [...kids.districts, row.label_en, row.label_ru].filter(Boolean).map(String),
    ),
  )

  return {
    level: level === 'neighborhood' ? 'city' : 'city',
    countryCode,
    regionCode,
    cityCode,
    cities: [cityCode, ...kids.cities],
    districts,
    ...base,
  }
}

/**
 * Resolve guest `where` chip/query → structured target from geo_locations (+ synonyms).
 * @param {string} value
 * @param {{ lang?: string }} [opts]
 * @returns {Promise<WhereTarget|null>}
 */
export async function resolveWhereTarget(value, opts = {}) {
  if (!value || value === 'all') return null
  const lang = opts.lang || 'en'
  const raw = String(value).trim()
  const aliased = resolveWhereSlugAlias(raw) || raw
  const v = aliased
  const vLower = norm(v)

  if (!supabaseAdmin) return null

  // 1) Exact code
  const byCode = await GeoService.getByCode(v)
  if (byCode) return targetFromRow(byCode, lang)
  const byCodeLower = await GeoService.getByCode(vLower)
  if (byCodeLower) return targetFromRow(byCodeLower, lang)

  // Country ISO
  if (/^[A-Za-z]{2}$/.test(v)) {
    const country = await GeoService.getByCode(v.toUpperCase())
    if (country?.level === 'country') return targetFromRow(country, lang)
  }

  // 2) Synonym
  const synCode = await GeoService.findBySynonym(raw, lang)
  if (synCode) {
    const synRow = await GeoService.getByCode(synCode)
    if (synRow) return targetFromRow(synRow, lang)
  }
  const synStar = await GeoService.findBySynonym(raw, '*')
  if (synStar && synStar !== synCode) {
    const synRow = await GeoService.getByCode(synStar)
    if (synRow) return targetFromRow(synRow, lang)
  }

  // 3) Label match (in-memory over active catalog — ~50–400 rows)
  const { data: rows } = await supabaseAdmin
    .from('geo_locations')
    .select(
      'code,level,parent_code,label_en,label_ru,label_th,label_zh,country_code,iso_country,centroid_lat,centroid_lng,is_active',
    )
    .eq('is_active', true)
    .limit(400)

  const needle = vLower
  const hit = (rows || []).find((row) => {
    const hay = [row.label_en, row.label_ru, row.label_th, row.label_zh, row.code]
      .filter(Boolean)
      .map(norm)
    return hay.some((h) => h === needle || h.includes(needle) || needle.includes(h))
  })
  if (hit) return targetFromRow(hit, lang)

  return null
}

/**
 * @param {WhereTarget|null} target
 * @returns {{ lat: number, lng: number } | null}
 */
export function centroidFromWhereTarget(target) {
  if (!target) return null
  const lat = Number(target.centroidLat)
  const lng = Number(target.centroidLng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

export { labelOf as geoRowLabel, zoomForLevel }
