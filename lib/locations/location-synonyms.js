/**
 * Stage 158.3 — geo_synonyms registry reader (cached, service_role).
 *
 * ## lang='*' (language-neutral)
 * Use `*` in the DB for aliases that are not tied to one UI locale:
 * - lowercase latin **search slugs** (`phuket`, `samui`, `bkk`, `moscow`)
 * - airport / shorthand codes (`bkk`, `msk`, `spb`)
 * - shared transliterations where script is unambiguous
 *
 * Locale-specific spellings belong in explicit rows: `ru` → `патонг`, `th` → `ป่าตอง`, etc.
 * Suggest query with `lang=ru` matches rows where `lang IN ('ru', '*')`.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { COUNTRY_PRESETS } from '@/lib/geo/country-presets'
import { WHERE_SLUG_ALIASES } from '@/lib/locations/where-slug-aliases'
import { DISTRICT_ALIASES } from '@/lib/locations/thailand-aliases'
import { GEO_SYNONYMS_FALLBACK_SEED } from '@/lib/locations/geo-synonyms-fallback.seed'
import { normalizeLocationQuery, scoreQueryAgainstTerms } from '@/lib/locations/location-text-match'

const CACHE_TTL_MS = 300_000

/** Cities not yet in country-presets / geo_locations but seeded for discovery. */
const CITY_LABEL_FALLBACKS = Object.freeze({
  samara: { ru: 'Самара', en: 'Samara', zh: '萨马拉', th: 'ซามารา' },
  'chiang-mai': { ru: 'Чиангмай', en: 'Chiang Mai', zh: '清迈', th: 'เชียงใหม่' },
  'hua-hin': { ru: 'Хуа Хин', en: 'Hua Hin', zh: '华欣', th: 'หัวหิน' },
  'phang-nga': { ru: 'Пхангнга', en: 'Phang Nga', zh: '攀牙', th: 'พังงา' },
})

/** @type {{ rows: object[] | null, byAlias: Map<string, object[]> | null, targets: Map<string, object> | null, ts: number }} */
let cache = { rows: null, byAlias: null, targets: null, ts: 0 }

/**
 * @typedef {object} GeoSynonymRow
 * @property {string} id
 * @property {string} target_code
 * @property {'country'|'region'|'city'|'district'} target_type
 * @property {'ru'|'en'|'th'|'zh'|'*'} lang
 * @property {string} alias_term
 * @property {number} weight
 */

/**
 * @typedef {object} PresetTargetMeta
 * @property {string} value
 * @property {'country'|'region'|'city'|'district'} level
 * @property {'city'|'district'} type
 * @property {Record<string, string>} labelByLang
 * @property {Record<string, string>} subtitleByLang
 * @property {string} [country_code]
 * @property {string} [region_code]
 * @property {string} [city_code]
 */

/** @returns {Map<string, PresetTargetMeta>} */
function buildPresetTargetMap() {
  /** @type {Map<string, PresetTargetMeta>} */
  const map = new Map()

  for (const country of COUNTRY_PRESETS) {
    const countryLabels = country.labels
    map.set(`country:${country.code}`, {
      value: country.code,
      level: 'country',
      type: 'city',
      labelByLang: countryLabels,
      subtitleByLang: {},
      country_code: country.code,
    })

    for (const region of country.regions) {
      map.set(`region:${region.code}`, {
        value: region.code,
        level: 'region',
        type: 'city',
        labelByLang: region.labels,
        subtitleByLang: {
          ru: countryLabels.ru,
          en: countryLabels.en,
          zh: countryLabels.zh,
          th: countryLabels.th,
        },
        country_code: country.code,
        region_code: region.code,
      })

      for (const city of region.cities) {
        map.set(`city:${city.code}`, {
          value: city.code,
          level: 'city',
          type: 'city',
          labelByLang: city.labels,
          subtitleByLang: {
            ru: countryLabels.ru,
            en: countryLabels.en,
            zh: countryLabels.zh,
            th: countryLabels.th,
          },
          country_code: country.code,
          region_code: region.code,
          city_code: city.code,
        })

        for (const district of city.districts || []) {
          const isPhuket = city.code === 'phuket-city'
          const dMeta = DISTRICT_ALIASES[district]
          map.set(`district:${district}`, {
            value: district,
            level: 'district',
            type: 'district',
            labelByLang: dMeta
              ? { ru: dMeta.ru, en: dMeta.en, zh: dMeta.zh, th: dMeta.th }
              : { en: district },
            subtitleByLang: isPhuket
              ? {
                  ru: 'Пхукет, Таиланд',
                  en: 'Phuket, Thailand',
                  zh: '普吉岛，泰国',
                  th: 'ภูเก็ต, ประเทศไทย',
                }
              : {
                  ru: `${region.labels.ru}, ${countryLabels.ru}`,
                  en: `${region.labels.en}, ${countryLabels.en}`,
                  zh: `${region.labels.zh}, ${countryLabels.zh}`,
                  th: `${region.labels.th}, ${countryLabels.th}`,
                },
            country_code: country.code,
            region_code: region.code,
            city_code: city.code,
          })
        }
      }
    }
  }

  return map
}

/** @type {Map<string, PresetTargetMeta> | null} */
let presetTargetMap = null

function getPresetTargetMap() {
  if (!presetTargetMap) presetTargetMap = buildPresetTargetMap()
  return presetTargetMap
}

/**
 * @param {object[]} rows
 */
function buildAliasIndexFromRows(rows) {
  /** @type {Map<string, GeoSynonymRow[]>} */
  const byAlias = new Map()
  for (const row of rows || []) {
    const key = normalizeLocationQuery(row.alias_term)
    if (!key) continue
    const list = byAlias.get(key) || []
    list.push(row)
    byAlias.set(key, list)
  }
  return byAlias
}

/**
 * @returns {Promise<{ rows: GeoSynonymRow[], byAlias: Map<string, GeoSynonymRow[]>, targets: Map<string, PresetTargetMeta> }>}
 */
export async function getGeoSynonymsIndex() {
  if (cache.rows && cache.byAlias && cache.targets && Date.now() - cache.ts < CACHE_TTL_MS) {
    return { rows: cache.rows, byAlias: cache.byAlias, targets: cache.targets }
  }

  const targets = getPresetTargetMap()

  if (!supabaseAdmin) {
    const rows = GEO_SYNONYMS_FALLBACK_SEED
    const byAlias = buildAliasIndexFromRows(rows)
    cache = { rows, byAlias, targets, ts: Date.now() }
    return { rows, byAlias, targets }
  }

  const { data, error } = await supabaseAdmin
    .from('geo_synonyms')
    .select('id, target_code, target_type, lang, alias_term, weight')
    .order('weight', { ascending: false })

  if (error) {
    if (error.code !== '42P01') {
      console.warn('[location-synonyms] load failed:', error.message)
    } else {
      console.warn('[location-synonyms] table missing — using bundled fallback seed (apply stage158_3 migration)')
    }
    const rows = GEO_SYNONYMS_FALLBACK_SEED
    const byAlias = buildAliasIndexFromRows(rows)
    cache = { rows, byAlias, targets, ts: Date.now() }
    return { rows, byAlias, targets }
  }

  const byAlias = buildAliasIndexFromRows(data)
  cache = { rows: data || [], byAlias, targets, ts: Date.now() }
  return { rows: data || [], byAlias, targets }
}

/**
 * @param {string} lang
 * @param {Record<string, string>} labels
 * @param {string} fallback
 */
function labelForLang(lang, labels, fallback) {
  return labels?.[lang] || labels?.en || labels?.ru || fallback
}

/**
 * @param {GeoSynonymRow} row
 * @param {string} lang
 * @param {Map<string, PresetTargetMeta>} targets
 */
function resolveSynonymTarget(row, lang, targets) {
  const key = `${row.target_type}:${row.target_code}`
  let meta = targets.get(key)

  if (!meta && row.target_type === 'city') {
    const slug = row.alias_term.trim().toLowerCase()
    const slugTarget = WHERE_SLUG_ALIASES[slug]
    if (slugTarget) {
      meta = targets.get(`city:${slugTarget}`) || targets.get(`region:${slugTarget}`)
    }
  }

  if (!meta && row.target_type === 'city' && CITY_LABEL_FALLBACKS[row.target_code]) {
    const labels = CITY_LABEL_FALLBACKS[row.target_code]
    meta = {
      value: row.target_code,
      level: 'city',
      type: 'city',
      labelByLang: labels,
      subtitleByLang: { ru: 'Россия', en: 'Russia', zh: '俄罗斯', th: 'รัสเซีย' },
      country_code: 'RU',
    }
  }

  if (!meta) return null

  const slug = row.alias_term.trim().toLowerCase()
  let value = meta.value
  if (row.target_type === 'city' && WHERE_SLUG_ALIASES[slug]) {
    value = slug
  }

  const label = labelForLang(lang, meta.labelByLang, row.target_code)
  const shortLabel = label.split(',')[0]?.trim() || label
  const subtitle = labelForLang(lang, meta.subtitleByLang, '')

  return {
    value,
    level: meta.level,
    type: meta.type,
    label: shortLabel,
    subtitle,
    country_code: meta.country_code,
    region_code: meta.region_code,
    city_code: meta.city_code,
  }
}

/**
 * Exact synonym lookup (first pass in suggest).
 * @param {string} q
 * @param {string} lang
 * @param {{ byAlias: Map<string, GeoSynonymRow[]>, targets: Map<string, PresetTargetMeta> }} index
 */
export function matchGeoSynonyms(q, lang, index) {
  const ql = normalizeLocationQuery(q)
  if (!ql || !index?.byAlias?.size) return []

  const candidates = index.byAlias.get(ql)
  if (!candidates?.length) return []

  const allowedLangs = new Set([lang, '*'])
  const filtered = candidates.filter((r) => allowedLangs.has(r.lang))
  if (!filtered.length) return []

  filtered.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight
    if (a.lang === lang && b.lang !== lang) return -1
    if (b.lang === lang && a.lang !== lang) return 1
    return 0
  })

  /** @type {Map<string, object>} */
  const out = new Map()

  for (const row of filtered) {
    const resolved = resolveSynonymTarget(row, lang, index.targets)
    if (!resolved) continue

    const dedupeKey = `${resolved.level}:${resolved.value}`
    const score = 95 + Math.min(row.weight, 100) / 10

    if (!out.has(dedupeKey) || out.get(dedupeKey)._score < score) {
      out.set(dedupeKey, {
        ...resolved,
        match_kind: 'synonym',
        matched_synonym: row.alias_term,
        matched_term: row.alias_term,
        _score: score,
      })
    }
  }

  return [...out.values()]
}

/**
 * Fuzzy pass over synonym alias terms (last resort after exact synonym + canonical).
 * @param {string} q
 * @param {string} lang
 * @param {{ rows: GeoSynonymRow[], byAlias: Map<string, GeoSynonymRow[]>, targets: Map<string, PresetTargetMeta> }} index
 */
export function fuzzyMatchGeoSynonyms(q, lang, index) {
  if (!index?.rows?.length) return []

  const allowedLangs = new Set([lang, '*'])
  /** @type {GeoSynonymRow[]} */
  const rows = index.rows.filter((r) => allowedLangs.has(r.lang))
  if (!rows.length) return []

  const terms = rows.map((r) => r.alias_term)
  const match = scoreQueryAgainstTerms(q, terms)
  if (match.score <= 0 || match.match_kind !== 'fuzzy') return []

  const matchedNorm = normalizeLocationQuery(match.matched_term || '')
  const row = rows.find((r) => normalizeLocationQuery(r.alias_term) === matchedNorm)
  if (!row) return []

  const resolved = resolveSynonymTarget(row, lang, index.targets)
  if (!resolved) return []

  return [
    {
      ...resolved,
      match_kind: 'fuzzy',
      matched_synonym: row.alias_term,
      matched_term: match.matched_term,
      _score: match.score,
      _similarity: match.similarity,
    },
  ]
}

/** @internal test helper */
export function resetGeoSynonymsCacheForTests() {
  cache = { rows: null, byAlias: null, targets: null, ts: 0 }
  presetTargetMap = null
}
