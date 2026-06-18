/**
 * Stage 158.2 — cached PENDING rows from location_suggestions for suggest API.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { normalizeLocationQuery, scoreQueryAgainstTerms } from '@/lib/locations/location-text-match'
import { expandQueryVariants } from '@/lib/locations/location-transliteration'

const CACHE_TTL_MS = 120_000

/** @type {{ rows: object[] | null, ts: number }} */
let cache = { rows: null, ts: 0 }

/**
 * @returns {Promise<object[]>}
 */
export async function getPendingLocationSuggestions() {
  if (cache.rows && Date.now() - cache.ts < CACHE_TTL_MS) {
    return cache.rows
  }

  if (!supabaseAdmin) {
    cache = { rows: [], ts: Date.now() }
    return []
  }

  const { data, error } = await supabaseAdmin
    .from('location_suggestions')
    .select('id, raw_term, kind, country_code, region_code, city_code, status')
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    if (error.code !== '42P01') {
      console.warn('[location-pending-suggestions]', error.message)
    }
    cache = { rows: [], ts: Date.now() }
    return []
  }

  cache = { rows: data || [], ts: Date.now() }
  return cache.rows
}

/**
 * @param {object[]} rows
 * @param {string} q
 */
export function matchPendingLocationSuggestions(rows, q) {
  const ql = normalizeLocationQuery(q)
  if (!ql || !rows?.length) return []

  const variants = expandQueryVariants(q)
  const out = []

  for (const row of rows) {
    const term = String(row.raw_term || '').trim()
    if (!term) continue

    const terms = [term, ...expandQueryVariants(term)]
    let bestScore = 0
    let matched_term = term

    for (const variant of variants) {
      const match = scoreQueryAgainstTerms(variant, terms)
      if (match.score > bestScore) {
        bestScore = match.score
        matched_term = match.matched_term || term
      }
    }

    const exact = normalizeLocationQuery(term) === ql
    const contains = normalizeLocationQuery(term).includes(ql) || ql.includes(normalizeLocationQuery(term))
    if (!exact && !contains && bestScore <= 0) continue

    const score = exact ? 58 : contains ? 52 : Math.min(56, bestScore)

    const kind = row.kind === 'city' ? 'city' : 'district'
    out.push({
      value: term,
      level: kind,
      type: kind,
      label: term,
      subtitle: '',
      country_code: row.country_code || undefined,
      region_code: row.region_code || undefined,
      city_code: row.city_code || undefined,
      match_kind: 'unverified',
      matched_term,
      is_new: true,
      listing_count: 0,
      _score: score,
    })
  }

  return out
}

/** @internal test helper */
export function resetPendingLocationSuggestionsCacheForTests() {
  cache = { rows: null, ts: 0 }
}
