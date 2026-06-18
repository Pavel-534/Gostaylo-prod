/**
 * Stage 158.1 / 158.3 — unified location index for suggest (presets + geo_locations labels).
 * Alias matching is handled by geo_synonyms (location-synonyms.js); this module only indexes canonical labels.
 */

import { COUNTRY_PRESETS } from '@/lib/geo/country-presets'
import { PHUKET_DISTRICTS_CANON } from '@/lib/locations/phuket-districts-canonical'
import { scoreQueryAgainstTerms } from '@/lib/locations/location-text-match'

/**
 * @typedef {object} LocationAliasEntry
 * @property {string} key
 * @property {string} value
 * @property {'country'|'region'|'city'|'district'} level
 * @property {'city'|'district'} type
 * @property {Record<string, string>} labelByLang
 * @property {string[]} terms
 * @property {Set<string>} aliasTerms
 * @property {string} [country_code]
 * @property {string} [region_code]
 * @property {string} [city_code]
 * @property {Record<string, string>} [subtitleByLang]
 */

const PHUKET_SUBTITLE = {
  ru: 'Пхукет, Таиланд',
  en: 'Phuket, Thailand',
  zh: '普吉岛，泰国',
  th: 'ภูเก็ต, ประเทศไทย',
}

/** @type {{ entries: LocationAliasEntry[], ts: number } | null} */
let staticCache = null
const STATIC_CACHE_TTL_MS = 120_000

/**
 * @param {string} lang
 * @param {Record<string, string> | undefined} labels
 * @param {string} fallback
 */
function labelForLang(lang, labels, fallback) {
  if (!labels) return fallback
  return labels[lang] || labels.en || labels.ru || fallback
}

/**
 * @param {LocationAliasEntry} entry
 * @param {string[]} items
 */
function appendTerms(entry, items) {
  for (const item of items) {
    const s = String(item || '').trim()
    if (!s) continue
    entry.terms.push(s)
  }
}

/**
 * @returns {LocationAliasEntry[]}
 */
function buildStaticAliasEntries() {
  /** @type {Map<string, LocationAliasEntry>} */
  const map = new Map()

  /**
   * @param {Omit<LocationAliasEntry, 'terms' | 'aliasTerms'> & { terms?: string[] }} partial
   */
  const upsert = (partial) => {
    const existing = map.get(partial.key)
    if (existing) {
      appendTerms(existing, partial.terms || [])
      return existing
    }
    const entry = {
      ...partial,
      terms: [],
      aliasTerms: new Set(),
    }
    appendTerms(entry, partial.terms || [])
    map.set(partial.key, entry)
    return entry
  }

  for (const country of COUNTRY_PRESETS) {
    const countryLabels = country.labels
    upsert({
      key: `country:${country.code}`,
      value: country.code,
      level: 'country',
      type: 'city',
      labelByLang: countryLabels,
      terms: [country.code, ...Object.values(countryLabels)],
      subtitleByLang: {},
      country_code: country.code,
    })

    for (const region of country.regions) {
      upsert({
        key: `region:${region.code}`,
        value: region.code,
        level: 'region',
        type: 'city',
        labelByLang: region.labels,
        terms: [region.code, ...Object.values(region.labels)],
        country_code: country.code,
        region_code: region.code,
        subtitleByLang: {
          ru: countryLabels.ru,
          en: countryLabels.en,
          zh: countryLabels.zh,
          th: countryLabels.th,
        },
      })

      for (const city of region.cities) {
        upsert({
          key: `city:${city.code}`,
          value: city.code,
          level: 'city',
          type: 'city',
          labelByLang: city.labels,
          terms: [city.code, ...Object.values(city.labels)],
          country_code: country.code,
          region_code: region.code,
          city_code: city.code,
          subtitleByLang: {
            ru: countryLabels.ru,
            en: countryLabels.en,
            zh: countryLabels.zh,
            th: countryLabels.th,
          },
        })

        for (const district of city.districts || []) {
          const isPhuket = PHUKET_DISTRICTS_CANON.includes(district)

          upsert({
            key: `district:${district}`,
            value: district,
            level: 'district',
            type: 'district',
            labelByLang: { en: district },
            terms: [district],
            country_code: country.code,
            region_code: region.code,
            city_code: city.code,
            subtitleByLang: isPhuket
              ? PHUKET_SUBTITLE
              : {
                  ru: `${region.labels.ru}, ${countryLabels.ru}`,
                  en: `${region.labels.en}, ${countryLabels.en}`,
                  zh: `${region.labels.zh}, ${countryLabels.zh}`,
                  th: `${region.labels.th}, ${countryLabels.th}`,
                },
          })
        }
      }
    }
  }

  return [...map.values()]
}

/**
 * @returns {LocationAliasEntry[]}
 */
export function getStaticLocationAliasEntries() {
  if (staticCache && Date.now() - staticCache.ts < STATIC_CACHE_TTL_MS) {
    return staticCache.entries
  }
  const entries = buildStaticAliasEntries()
  staticCache = { entries, ts: Date.now() }
  return entries
}

/**
 * @param {object[]} geoRows
 * @returns {LocationAliasEntry[]}
 */
export function mergeGeoRowsIntoAliasEntries(geoRows) {
  const base = getStaticLocationAliasEntries()
  /** @type {Map<string, LocationAliasEntry>} */
  const map = new Map(
    base.map((e) => [e.key, { ...e, terms: [...e.terms], aliasTerms: new Set(e.aliasTerms) }]),
  )

  for (const row of geoRows || []) {
    const level = row.level
    const key = `${level}:${row.code}`
    const labels = {
      en: row.label_en,
      ru: row.label_ru,
      zh: row.label_zh,
      th: row.label_th,
    }
    const terms = [row.code, row.label_en, row.label_ru, row.label_zh, row.label_th].filter(Boolean)
    const existing = map.get(key)
    if (existing) {
      appendTerms(existing, terms)
      existing.labelByLang = { ...existing.labelByLang, ...labels }
    } else {
      map.set(key, {
        key,
        value: row.code,
        level,
        type: level === 'district' ? 'district' : 'city',
        labelByLang: labels,
        terms,
        aliasTerms: new Set(),
        country_code: row.iso_country || (level === 'country' ? row.code : undefined),
        region_code: level === 'region' ? row.code : level === 'city' ? row.parent_code : undefined,
        city_code: level === 'city' ? row.code : undefined,
        subtitleByLang: {},
      })
    }
  }

  return [...map.values()]
}

/**
 * Fuzzy / prefix / contains pass on canonical labels (synonyms handled separately).
 * @param {LocationAliasEntry[]} entries
 * @param {string} q
 * @param {string} lang
 */
export function matchLocationAliasEntries(entries, q, lang) {
  const out = []
  for (const entry of entries) {
    const match = scoreQueryAgainstTerms(q, entry.terms)
    if (match.score <= 0) continue

    const label = labelForLang(lang, entry.labelByLang, entry.value)
    const shortLabel = label.split(',')[0]?.trim() || label
    const subtitle = labelForLang(lang, entry.subtitleByLang, '')

    out.push({
      value: entry.value,
      level: entry.level,
      type: entry.type,
      label: shortLabel,
      subtitle,
      country_code: entry.country_code,
      region_code: entry.region_code,
      city_code: entry.city_code,
      match_kind: match.match_kind,
      matched_term: match.matched_term,
      _score: match.score,
      _similarity: match.similarity,
    })
  }
  return out
}

/** Test-only */
export function resetLocationAliasIndexCacheForTests() {
  staticCache = null
}
