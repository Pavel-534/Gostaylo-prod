/**
 * Stage 178.9 — record «Куда» on filter commit (home + catalog «Найти»).
 */

import { getDestinationLabel } from '@/lib/locations/popular-destinations'
import { recordRecentSearchLocation } from '@/lib/search/recent-search-locations'

function resolveWhereFallback(whereValue) {
  return String(whereValue || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
}

/**
 * @param {{ where?: string, language?: string }} params
 */
export function commitRecentSearchLocation({ where, language = 'ru' } = {}) {
  const value = String(where || '').trim()
  if (!value || value === 'all') return
  const label =
    getDestinationLabel(value, language) || resolveWhereFallback(value) || value
  recordRecentSearchLocation({ value, label })
}
