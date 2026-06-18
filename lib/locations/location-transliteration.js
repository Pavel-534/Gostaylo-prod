/**
 * Stage 158.2 — minimal RU ↔ EN transliteration for location suggest (popular pairs only).
 * Full transliterator deferred to Stage 165+.
 */

import { normalizeLocationQuery } from '@/lib/locations/location-text-match'

/** @type {readonly [string, string][]} lowercase ru/en pairs */
export const POPULAR_LOCATION_TRANSLIT_PAIRS = Object.freeze([
  ['пхукет', 'phuket'],
  ['патонг', 'patong'],
  ['чалонг', 'chalong'],
  ['бангкок', 'bangkok'],
  ['паттайя', 'pattaya'],
  ['самуи', 'samui'],
  ['краби', 'krabi'],
  ['москва', 'moscow'],
  ['сочи', 'sochi'],
  ['казань', 'kazan'],
  ['санкт-петербург', 'saint petersburg'],
  ['спб', 'spb'],
  ['равай', 'rawai'],
  ['ката', 'kata'],
  ['карон', 'karon'],
  ['камала', 'kamala'],
  ['тайланд', 'thailand'],
  ['таиланд', 'thailand'],
])

/**
 * @param {string} q
 * @returns {string[]}
 */
export function expandQueryVariants(q) {
  const base = normalizeLocationQuery(q)
  if (!base) return []
  const out = new Set([base, q.trim().toLowerCase()])

  for (const [ru, en] of POPULAR_LOCATION_TRANSLIT_PAIRS) {
    if (base === ru) out.add(en)
    if (base === en) out.add(ru)
    if (base.startsWith(ru) && ru.length >= 3) out.add(en + base.slice(ru.length))
    if (base.startsWith(en) && en.length >= 3) out.add(ru + base.slice(en.length))
  }

  return [...out].filter(Boolean)
}
