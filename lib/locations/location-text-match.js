/**
 * Stage 158.1 — text scoring for location suggest (exact → alias → prefix → contains → fuzzy).
 */

/** Minimum Levenshtein similarity (1 - dist/maxLen) to accept a fuzzy match. Tune after real typo tests. */
export const LOCATION_FUZZY_SIMILARITY_MIN = 0.72
/** Relaxed threshold for short queries (3–5 chars). */
export const LOCATION_FUZZY_SIMILARITY_MIN_SHORT = 0.65
export const LOCATION_FUZZY_SHORT_QUERY_MAX_LEN = 5

/** @typedef {'exact' | 'alias' | 'prefix' | 'contains' | 'fuzzy' | 'unverified' | 'synonym'} LocationMatchKind */

/**
 * @typedef {object} LocationTextMatchResult
 * @property {number} score
 * @property {LocationMatchKind | null} match_kind
 * @property {string | null} matched_term
 * @property {number} [similarity]
 */

/**
 * @param {string} s
 */
export function normalizeLocationQuery(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/**
 * @param {string} a
 * @param {string} b
 */
export function levenshteinDistance(a, b) {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  const row = new Array(n + 1)
  for (let j = 0; j <= n; j++) row[j] = j

  for (let i = 1; i <= m; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = row[j]
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost)
      prev = tmp
    }
  }
  return row[n]
}

/**
 * @param {string} a normalized
 * @param {string} b normalized
 */
export function stringSimilarity(a, b) {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshteinDistance(a, b) / maxLen
}

import { expandQueryVariants } from '@/lib/locations/location-transliteration'

/**
 * @param {string} q normalized
 */
function resolveFuzzyMinForQuery(q) {
  if (q.length <= LOCATION_FUZZY_SHORT_QUERY_MAX_LEN) {
    return LOCATION_FUZZY_SIMILARITY_MIN_SHORT
  }
  return LOCATION_FUZZY_SIMILARITY_MIN
}

/**
 * Score single normalized query variant against terms.
 * @param {string} ql normalized query
 * @param {string[]} terms
 * @param {{ fuzzyMin?: number, aliasTerms?: Set<string> }} opts
 * @returns {LocationTextMatchResult}
 */
function scoreQueryVariantAgainstTerms(ql, terms, opts = {}) {
  const fuzzyMin = opts.fuzzyMin ?? resolveFuzzyMinForQuery(ql)
  const aliasTerms = opts.aliasTerms
  if (!ql) {
    return { score: 0, match_kind: null, matched_term: null }
  }

  /** @type {LocationTextMatchResult} */
  let best = { score: 0, match_kind: null, matched_term: null }

  const consider = (score, match_kind, matched_term, similarity) => {
    if (score <= best.score) return
    best = { score, match_kind, matched_term, similarity }
  }

  for (const raw of terms) {
    const t = normalizeLocationQuery(raw)
    if (!t) continue

    const isAlias = aliasTerms?.has(t) || aliasTerms?.has(raw)

    if (t === ql) {
      consider(isAlias ? 90 : 100, isAlias ? 'alias' : 'exact', raw)
      continue
    }

    if (ql.length >= 2 && t.startsWith(ql)) {
      consider(isAlias ? 75 : 85, isAlias ? 'alias' : 'prefix', raw)
      continue
    }

    if (ql.length >= 2 && ql.startsWith(t) && t.length >= 3) {
      consider(isAlias ? 72 : 82, isAlias ? 'alias' : 'prefix', raw)
      continue
    }

    if (ql.length >= 2 && t.includes(ql)) {
      consider(isAlias ? 60 : 55, isAlias ? 'alias' : 'contains', raw)
      continue
    }

    if (ql.length >= 3 && t.length >= 3) {
      const allowLongFuzzy = !raw.includes(',') && t.length <= ql.length + 4

      const sim = stringSimilarity(ql, t)
      if (sim >= fuzzyMin) {
        const fuzzyScore = 40 + Math.round(sim * 25)
        consider(fuzzyScore, 'fuzzy', raw, sim)
      }

      if (allowLongFuzzy && t.length > ql.length) {
        const minW = Math.max(3, ql.length - 1)
        const maxW = Math.min(t.length, ql.length + 1)
        for (let w = minW; w <= maxW; w++) {
          for (let i = 0; i <= t.length - w; i++) {
            const sub = t.slice(i, i + w)
            const subSim = stringSimilarity(ql, sub)
            if (subSim >= fuzzyMin) {
              let fuzzyScore = 40 + Math.round(subSim * 25)
              if (t.startsWith(sub) || sub === t.slice(0, w)) fuzzyScore += 6
              consider(fuzzyScore, 'fuzzy', sub, subSim)
            }
          }
        }
      }
    }
  }

  return best
}

/**
 * @param {string} q raw query
 * @param {string[]} terms search terms (canonical + aliases)
 * @param {{ fuzzyMin?: number, aliasTerms?: Set<string> }} [opts]
 * @returns {LocationTextMatchResult}
 */
export function scoreQueryAgainstTerms(q, terms, opts = {}) {
  const variants = expandQueryVariants(q)
  const fuzzyMin =
    opts.fuzzyMin ??
    resolveFuzzyMinForQuery(normalizeLocationQuery(q))

  /** @type {LocationTextMatchResult} */
  let best = { score: 0, match_kind: null, matched_term: null }

  for (const variant of variants) {
    const ql = normalizeLocationQuery(variant)
    const result = scoreQueryVariantAgainstTerms(ql, terms, { ...opts, fuzzyMin })
    if (result.score > best.score) best = result
  }

  return best
}

/**
 * Highlight range in label for UI (client-safe).
 * @param {string} label
 * @param {string} [needle]
 * @returns {{ before: string, match: string, after: string } | null}
 */
export function splitLabelHighlight(label, needle) {
  if (!label || !needle) return null
  const idx = label.toLowerCase().indexOf(needle.toLowerCase())
  if (idx < 0) return null
  return {
    before: label.slice(0, idx),
    match: label.slice(idx, idx + needle.length),
    after: label.slice(idx + needle.length),
  }
}
