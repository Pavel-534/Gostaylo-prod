/**
 * Stage 178.9 — record «Куда» on filter commit (home + catalog «Найти»).
 * Stage 201.82 — labels via resolveWhereDisplayLabel (geo/popular), not raw slug.
 */

import { resolveWhereDisplayLabelOrFallback } from '@/lib/locations/resolve-where-display-label'
import { recordRecentSearchLocation } from '@/lib/search/recent-search-locations'

/**
 * @param {{ where?: string, language?: string, label?: string }} params
 */
export function commitRecentSearchLocation({ where, language = 'ru', label: labelOverride } = {}) {
  const value = String(where || '').trim()
  if (!value || value === 'all') return
  const label =
    String(labelOverride || '').trim() ||
    resolveWhereDisplayLabelOrFallback(value, language)
  recordRecentSearchLocation({ value, label })
}
