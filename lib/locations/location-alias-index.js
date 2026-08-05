/**
 * Stage 158.1 / 200.38 — location alias index from geo_locations rows only.
 */

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
 * Build suggest alias entries from geo_locations rows (DB-first).
 * @param {object[]} geoRows
 * @returns {LocationAliasEntry[]}
 */
export function mergeGeoRowsIntoAliasEntries(geoRows) {
  /** @type {Map<string, LocationAliasEntry>} */
  const map = new Map()

  for (const row of geoRows || []) {
    const level = row.level === 'neighborhood' ? 'city' : row.level
    if (!row?.code || !level) continue
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
      continue
    }
    map.set(key, {
      key,
      value: row.code,
      level,
      type: level === 'district' ? 'district' : 'city',
      labelByLang: labels,
      terms: [...terms],
      aliasTerms: new Set(),
      country_code:
        row.iso_country ||
        row.country_code ||
        (level === 'country' ? row.code : undefined),
      region_code: level === 'region' ? row.code : level === 'city' ? row.parent_code : undefined,
      city_code: level === 'city' ? row.code : undefined,
      subtitleByLang: {},
    })
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

/** @deprecated no static preset index — kept for tests */
export function getStaticLocationAliasEntries() {
  return []
}

/** Test-only */
export function resetLocationAliasIndexCacheForTests() {
  /* no-op: no static cache */
}
