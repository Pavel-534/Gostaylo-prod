/**

 * Stage 158 / 158.1 / 158.2 — server-side location suggest (alias index + fuzzy + inventory rank).

 */



import { supabaseAdmin } from '@/lib/supabase'

import { COUNTRY_PRESETS } from '@/lib/geo/country-presets'

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

const LEVEL_SPECIFICITY = { country: 1, region: 2, city: 3, district: 4 }



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

 * @param {Record<string, string> | null | undefined} labels

 * @param {string} fallback

 */

function labelForLang(lang, labels, fallback) {

  if (!labels) return fallback

  return labels[lang] || labels.en || labels.ru || fallback

}



/**

 * @param {string} countryCode

 * @param {string} lang

 */

function countryLabel(countryCode, lang) {

  const c = COUNTRY_PRESETS.find((x) => x.code === countryCode)

  return c ? labelForLang(lang, c.labels, countryCode) : countryCode

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

    .select('level, code, parent_code, label_en, label_ru, label_zh, label_th, iso_country')

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

 * @returns {LocationSuggestItem[]}

 */

function popularCandidates(lang, inventory) {

  const out = []

  for (const chip of POPULAR_DESTINATIONS_FLAT) {

    const canonical = resolveWhereSlugAlias(chip.value) || chip.value

    const label = chip.labels[lang] || chip.labels.en



    /** @type {LocationSuggestItem} */

    let item = {

      value: chip.value,

      level: 'city',

      type: 'city',

      label,

      subtitle: '',

      listing_count: 0,

    }



    if (canonical.includes('-') && canonical.length <= 6 && canonical === canonical.toUpperCase()) {

      item.level = 'region'

      item.region_code = canonical

      item.country_code = canonical.split('-')[0]

      item.subtitle = countryLabel(item.country_code, lang)

    } else {

      const presetCity = findPresetCity(canonical)

      if (presetCity) {

        item.city_code = presetCity.city.code

        item.region_code = presetCity.region.code

        item.country_code = presetCity.country.code

        item.subtitle = countryLabel(presetCity.country.code, lang)

      } else {

        item.city_code = canonical

      }

    }



    item.listing_count = listingCountForItem(inventory, item)

    out.push(item)

  }



  return out.sort((a, b) => b.listing_count - a.listing_count || a.label.localeCompare(b.label))

}



/**

 * @param {string} cityCode

 */

function findPresetCity(cityCode) {

  for (const country of COUNTRY_PRESETS) {

    for (const region of country.regions) {

      const city = region.cities.find((c) => c.code === cityCode)

      if (city) return { country, region, city }

    }

  }

  return null

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

    const specA = LEVEL_SPECIFICITY[a.level] ?? 0

    const specB = LEVEL_SPECIFICITY[b.level] ?? 0

    if (specB !== specA) return specB - specA

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

      items: popularCandidates(lang, inventory).slice(0, limit),

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


