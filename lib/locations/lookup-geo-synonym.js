/**
 * Stage 161 — exact geo_synonyms lookup (shared by capture auto-merge + batch normalize).
 */

import { normalizeLocationQuery } from '@/lib/locations/location-text-match'
import { getGeoSynonymsIndex } from '@/lib/locations/location-synonyms'

/** Auto-merge / batch normalize only when synonym is high-confidence. */
export const GEO_SYNONYM_AUTO_MERGE_MIN_WEIGHT = 80

/**
 * @typedef {object} GeoSynonymMatch
 * @property {string} id
 * @property {string} target_code
 * @property {'country'|'region'|'city'|'district'} target_type
 * @property {string} alias_term
 * @property {number} weight
 * @property {'ru'|'en'|'th'|'zh'|'*'} lang
 */

/**
 * @param {string} term
 * @param {{ byAlias: Map<string, object[]>, rows?: object[] }} index
 * @param {{ minWeight?: number, lang?: string }} [opts]
 * @returns {GeoSynonymMatch | null}
 */
export function lookupGeoSynonym(term, index, opts = {}) {
  const ql = normalizeLocationQuery(term)
  if (!ql || !index?.byAlias?.size) return null

  const minWeight = opts.minWeight ?? 0
  const lang = opts.lang
  const candidates = index.byAlias.get(ql)
  if (!candidates?.length) return null

  const allowedLangs = lang ? new Set([lang, '*']) : null
  const filtered = candidates.filter((r) => {
    if (r.weight < minWeight) return false
    if (allowedLangs && !allowedLangs.has(r.lang)) return false
    return true
  })

  if (!filtered.length) return null

  filtered.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight
    if (lang && a.lang === lang && b.lang !== lang) return -1
    if (lang && b.lang === lang && a.lang !== lang) return 1
    return 0
  })

  const best = filtered[0]
  return {
    id: best.id,
    target_code: best.target_code,
    target_type: best.target_type,
    alias_term: best.alias_term,
    weight: best.weight,
    lang: best.lang,
  }
}

/**
 * @param {string} term
 * @param {{ minWeight?: number, lang?: string }} [opts]
 */
export async function lookupGeoSynonymLive(term, opts = {}) {
  const index = await getGeoSynonymsIndex()
  return lookupGeoSynonym(term, index, opts)
}

/**
 * @param {string} term
 * @param {{ minWeight?: number, lang?: string, index?: { byAlias: Map<string, object[]> } }} [opts]
 */
export async function lookupGeoSynonymForAutoMerge(term, opts = {}) {
  const index = opts.index || (await getGeoSynonymsIndex())
  return lookupGeoSynonym(term, index, {
    minWeight: opts.minWeight ?? GEO_SYNONYM_AUTO_MERGE_MIN_WEIGHT,
    lang: opts.lang,
  })
}
