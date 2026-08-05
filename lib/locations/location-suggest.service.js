/**
 * Stage 158 / 200.37 — server-side location suggest (geo_locations + geo_synonyms + inventory).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { POPULAR_DESTINATIONS_FLAT } from '@/lib/locations/popular-destinations'
import { resolveWhereSlugAlias } from '@/lib/locations/where-slug-aliases'
import { getLocationInventoryIndex } from '@/lib/locations/location-inventory-cache'
import {
  mergeGeoRowsIntoAliasEntries,
  matchLocationAliasEntries,
} from '@/lib/locations/location-alias-index'
import {
  getPendingLocationSuggestions,
  matchPendingLocationSuggestions,
} from '@/lib/locations/location-pending-suggestions-cache'
import { getGeoSynonymsIndex, matchGeoSynonyms, fuzzyMatchGeoSynonyms } from '@/lib/locations/location-synonyms'

const SUPPORTED_LANGS = ['ru', 'en', 'zh', 'th']
/** Stage 200.37 — when scores tie: country → region → city */
const LEVEL_RANK = { country: 1, region: 2, city: 3, neighborhood: 3, district: 4 }

/** @type {{ rows: object[] | null, ts: number }} */
let geoCache = { rows: null, ts: 0 }
const GEO_CACHE_TTL_MS = 120_000

/**
 * @typedef {object} LocationSuggestItem
 * @property {string} value
 * @property {'country'|'region'|'city'|'district'} level
 * @property {'city'|'district'} type
 * @property {string} label
 * @property {string} [subtitle]
 * @property {number} listing_count
 * @property {string} [country_code]
 * @property {string} [region_code]
 * @property {string} [city_code]
 * @property {'exact'|'alias'|'prefix'|'contains'|'fuzzy'|'unverified'|'synonym'} [match_kind]
 * @property {string} [matched_term]
 * @property {string} [matched_synonym]
 * @property {boolean} [is_new]
 */

export function normalizeSuggestLang(lang) {
  const l = String(lang || 'en').toLowerCase()
  return SUPPORTED_LANGS.includes(l) ? l : 'en'
}

export function clampSuggestLimit(limit) {
  const n = parseInt(limit, 10)
  if (!Number.isFinite(n)) return 10
  return Math.min(20, Math.max(1, n))
}

/**
 * @param {string} q
 */
export function sanitizeSuggestQuery(q) {
  return String(q || '')
    .trim()
    .replace(/[%(),.\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 64)
}

/**
 * @param {string} lang
 * @param {object|null|undefined} row
 * @param {string} fallback
 */
function geoLabel(lang, row, fallback) {
  if (!row) return fallback
  return (
    (lang === 'ru' && row.label_ru) ||
    (lang === 'th' && row.label_th) ||
    (lang === 'zh' && row.label_zh) ||
    row.label_en ||
    row.label_ru ||
    fallback
  )
}

/**
 * @param {object[]} geoRows
 * @param {string} countryCode
 * @param {string} lang
 */
function countryLabelFromGeo(geoRows, countryCode, lang) {
  const code = String(countryCode || '').toUpperCase()
  const row = (geoRows || []).find((r) => r.level === 'country' && r.code === code)
  return geoLabel(lang, row, code)
}

/**
 * @param {object[]} geoRows
 * @param {string} code
 */
function findGeoRow(geoRows, code) {
  const c = String(code || '').trim()
  if (!c) return null
  const lower = c.toLowerCase()
  return (
    (geoRows || []).find((r) => r.code === c) ||
    (geoRows || []).find((r) => String(r.code || '').toLowerCase() === lower) ||
    null
  )
}

/**
 * @param {import('./location-inventory-cache.js').LocationInventoryIndex} inventory
 * @param {LocationSuggestItem} item
 */
function listingCountForItem(inventory, item) {
  switch (item.level) {
    case 'district':
      return inventory.districtCount(item.value)
    case 'city':
      return inventory.cityCount(item.city_code || item.value)
    case 'region':
      return inventory.regionCount(item.region_code || item.value)
    case 'country':
      return inventory.countryCount(item.country_code || item.value)
    default:
      return 0
  }
}

/**
 * @returns {Promise<object[]>}
 */
async function loadGeoLocations() {
  if (geoCache.rows && Date.now() - geoCache.ts < GEO_CACHE_TTL_MS) {
    return geoCache.rows
  }
  if (!supabaseAdmin) {
    geoCache = { rows: [], ts: Date.now() }
    return []
  }

  const { data, error } = await supabaseAdmin
    .from('geo_locations')
    .select(
      'level, code, parent_code, label_en, label_ru, label_zh, label_th, iso_country, country_code, is_active',
    )
    .eq('is_active', true)
    .order('level')
    .order('label_en')

  if (error) {
    console.error('[location-suggest] geo_locations:', error.message)
    geoCache = { rows: [], ts: Date.now() }
    return []
  }

  geoCache = { rows: data || [], ts: Date.now() }
  return geoCache.rows
}

/**
 * @param {string} lang
 * @param {import('./location-inventory-cache.js').LocationInventoryIndex} inventory
 * @param {object[]} geoRows
 * @returns {LocationSuggestItem[]}
 */
function popularCandidates(lang, inventory, geoRows) {
  const out = []

  for (const chip of POPULAR_DESTINATIONS_FLAT) {
    const canonical = resolveWhereSlugAlias(chip.value) || chip.value
    const chipLabel = chip.labels[lang] || chip.labels.en
    const row = findGeoRow(geoRows, canonical)

    /** @type {LocationSuggestItem} */
    let item = {
      value: row?.code || chip.value,
      level: 'city',
      type: 'city',
      label: geoLabel(lang, row, chipLabel),
      subtitle: '',
      listing_count: 0,
    }

    if (row) {
      const level = row.level === 'neighborhood' ? 'city' : row.level
      item.level = level === 'district' ? 'district' : level
      item.type = level === 'district' ? 'district' : 'city'
      if (level === 'country') {
        item.country_code = row.code
      } else if (level === 'region') {
        item.region_code = row.code
        item.country_code = row.iso_country || row.country_code || String(row.parent_code || '').slice(0, 2)
        item.subtitle = countryLabelFromGeo(geoRows, item.country_code, lang)
      } else {
        item.city_code = row.code
        item.region_code = row.parent_code || undefined
        item.country_code =
          row.iso_country || row.country_code || String(row.parent_code || '').slice(0, 2)
        item.subtitle = countryLabelFromGeo(geoRows, item.country_code, lang)
      }
    } else if (
      canonical.includes('-') &&
      canonical.length <= 6 &&
      canonical === canonical.toUpperCase()
    ) {
      item.level = 'region'
      item.region_code = canonical
      item.country_code = canonical.split('-')[0]
      item.subtitle = countryLabelFromGeo(geoRows, item.country_code, lang)
    } else {
      item.city_code = canonical
    }

    item.listing_count = listingCountForItem(inventory, item)
    out.push(item)
  }

  return out.sort(
    (a, b) =>
      b.listing_count - a.listing_count ||
      (LEVEL_RANK[a.level] ?? 9) - (LEVEL_RANK[b.level] ?? 9) ||
      a.label.localeCompare(b.label),
  )
}

/**
 * @param {LocationSuggestItem[]} items
 * @param {import('./location-inventory-cache.js').LocationInventoryIndex} inventory
 * @param {number} limit
 */
function rankAndDedupe(items, inventory, limit) {
  const byKey = new Map()

  for (const raw of items) {
    const key = `${raw.level}:${raw.value}`
    const listing_count = listingCountForItem(inventory, raw)
    const existing = byKey.get(key)
    const score = raw._score ?? 0
    if (!existing || score > existing._score) {
      byKey.set(key, { ...raw, listing_count, _score: score })
    }
  }

  const ranked = [...byKey.values()].sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score
    if (b.listing_count !== a.listing_count) return b.listing_count - a.listing_count
    const rankA = LEVEL_RANK[a.level] ?? 9
    const rankB = LEVEL_RANK[b.level] ?? 9
    if (rankA !== rankB) return rankA - rankB
    return a.label.localeCompare(b.label)
  })

  return ranked.slice(0, limit).map(({ _score, _similarity, ...item }) => item)
}

/**
 * @param {{ q?: string, lang?: string, limit?: number }} params
 */
export async function suggestLocations(params = {}) {
  const lang = normalizeSuggestLang(params.lang)
  const limit = clampSuggestLimit(params.limit)
  const rawQ = sanitizeSuggestQuery(params.q)
  const inventory = await getLocationInventoryIndex()
  const geoRows = await loadGeoLocations()

  if (!rawQ) {
    return {
      mode: 'popular',
      query: '',
      lang,
      items: popularCandidates(lang, inventory, geoRows).slice(0, limit),
    }
  }

  const entries = mergeGeoRowsIntoAliasEntries(geoRows)
  const synonymIndex = await getGeoSynonymsIndex()
  const synonyms = matchGeoSynonyms(rawQ, lang, synonymIndex)
  const matchedAll = matchLocationAliasEntries(entries, rawQ, lang)
  const matched = matchedAll.filter((m) => m.match_kind !== 'fuzzy')
  const fuzzyCanonical = matchedAll.filter((m) => m.match_kind === 'fuzzy')
  const fuzzySynonyms = fuzzyMatchGeoSynonyms(rawQ, lang, synonymIndex)
  const pendingRows = await getPendingLocationSuggestions()
  const unverified = matchPendingLocationSuggestions(pendingRows, rawQ)

  const items = rankAndDedupe(
    [...synonyms, ...matched, ...unverified, ...fuzzyCanonical, ...fuzzySynonyms],
    inventory,
    limit,
  )

  return {
    mode: 'suggest',
    query: rawQ,
    lang,
    items,
  }
}
