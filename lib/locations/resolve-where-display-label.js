/**
 * Stage 201.82 — guest «Куда?» display label SSOT (not URL slug).
 *
 * Order: popular chip labels → launch geo seed → title-case slug fallback.
 * Never return the raw slug as if it were a localized label (fixes «чита» → «chita»).
 */

import { POPULAR_DESTINATIONS_FLAT } from '@/lib/locations/popular-destinations'
import { findLaunchGeoByCode, launchGeoLabel } from '@/lib/geo/launch-geo-index'

/**
 * @param {string} whereValue
 * @returns {string}
 */
export function titleCaseWhereSlug(whereValue) {
  return String(whereValue || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
}

/**
 * @param {string | null | undefined} value — canonical where code / slug
 * @param {string} [language='ru']
 * @returns {string | null} localized label, or null if unknown
 */
export function resolveWhereDisplayLabel(value, language = 'ru') {
  const code = String(value || '').trim()
  if (!code || code === 'all') return null

  const popular = POPULAR_DESTINATIONS_FLAT.find((d) => d.value === code)
  if (popular) {
    return popular.labels[language] || popular.labels.en || popular.labels.ru || null
  }

  const row = findLaunchGeoByCode(code)
  if (row) {
    const label = launchGeoLabel(language, row, '')
    if (label && label !== row.code) return label
    if (label) return label
  }

  return null
}

/**
 * @param {string | null | undefined} value
 * @param {string} [language='ru']
 * @returns {string}
 */
export function resolveWhereDisplayLabelOrFallback(value, language = 'ru') {
  const code = String(value || '').trim()
  if (!code || code === 'all') return ''
  return resolveWhereDisplayLabel(code, language) || titleCaseWhereSlug(code) || code
}

/**
 * True when stored recent label looks like a raw slug (legacy bug).
 * Also catches title-cased codes: TH-PHK → «Th Phk» (Stage 202.4 sticky chrome).
 * @param {string | null | undefined} label
 * @param {string | null | undefined} value
 */
export function isLikelyRawWhereSlugLabel(label, value) {
  const L = String(label || '').trim()
  const V = String(value || '').trim()
  if (!L) return true
  if (V && L.toLowerCase() === V.toLowerCase()) return true
  if (V && titleCaseWhereSlug(V) === L) return true
  // Title-case with spaces of a hyphenated code: "Th Phk" from "TH-PHK"
  const compactL = L.toLowerCase().replace(/\s+/g, '-')
  if (V && compactL === V.toLowerCase().replace(/_/g, '-')) return true
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(L)
}

/**
 * Guest «Куда?» input / compact chip label (Stage 202.4).
 * Prefer SSOT display name; never show raw geo codes or title-cased slugs.
 * @param {string | null | undefined} whereValue
 * @param {{ value: string, label?: string }[]} [options]
 * @param {string} [language='ru']
 * @returns {string | null}
 */
export function resolveGuestWhereInputLabel(whereValue, options = [], language = 'ru') {
  if (!whereValue || whereValue === 'all') return null
  const v = String(whereValue)
  const match = (options || []).find((o) => String(o.value).toLowerCase() === v.toLowerCase())
  const optLabel = match?.label
  const ssot = resolveWhereDisplayLabelOrFallback(v, language)
  if (ssot && ssot !== v && !isLikelyRawWhereSlugLabel(ssot, v)) return ssot
  if (optLabel && optLabel !== v && !isLikelyRawWhereSlugLabel(optLabel, v)) return optLabel
  if (ssot && !isLikelyRawWhereSlugLabel(ssot, v)) return ssot
  return null
}
