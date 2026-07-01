/**
 * Stage 177.4 — SSOT parse/normalize service & nanny discovery facet URL values.
 */

import { parseUrlWithCaptainFilterParam } from '@/lib/search/discovery-vertical-facet-parse'

/** Wizard + SearchFiltersDialog (`nanny-search-langs.js`). */
export const DISCOVERY_SERVICE_LANG_IDS = new Set(['ru', 'en', 'th', 'zh'])

const SERVICE_SPECIALIZATION_URL_MAX = 200

/**
 * @typedef {'absent'|'inactive'|'active'|'invalid'} DiscoveryServiceFacetParseKind
 */

/**
 * nanny_langs CSV → canonical lang codes (whitelist).
 * @param {URLSearchParams} sp
 * @param {string} [key]
 * @returns {{ kind: DiscoveryServiceFacetParseKind, value?: string[] }}
 */
export function parseUrlNannyLangsParam(sp, key = 'nanny_langs') {
  const raw = sp.get(key)
  if (raw == null || String(raw).trim() === '') {
    return { kind: 'absent' }
  }

  const tokens = String(raw)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  if (!tokens.length) {
    return { kind: 'inactive' }
  }

  /** @type {string[]} */
  const langs = []
  let hadInvalid = false

  for (const token of tokens) {
    if (DISCOVERY_SERVICE_LANG_IDS.has(token)) {
      langs.push(token)
    } else {
      hadInvalid = true
    }
  }

  if (hadInvalid) {
    return { kind: 'invalid' }
  }

  if (!langs.length) {
    return { kind: 'inactive' }
  }

  return { kind: 'active', value: [...new Set(langs)].sort() }
}

/**
 * nanny_experience_min: absent, <=0 inactive, >=1 active.
 * @param {URLSearchParams} sp
 * @param {string[]} keys
 * @returns {{ kind: DiscoveryServiceFacetParseKind, value?: number }}
 */
export function parseUrlServiceExperienceMinParam(sp, ...keys) {
  for (const k of keys) {
    const raw = sp.get(k)
    if (raw == null || raw === '') continue
    const n = parseInt(String(raw), 10)
    if (!Number.isFinite(n)) {
      return { kind: 'invalid' }
    }
    if (n <= 0) {
      return { kind: 'inactive' }
    }
    return { kind: 'active', value: n }
  }
  return { kind: 'absent' }
}

/**
 * service_home_visit / home_visit_only: only explicit true activates.
 * @param {URLSearchParams} sp
 * @param {string[]} keys
 * @returns {{ kind: DiscoveryServiceFacetParseKind }}
 */
export function parseUrlServiceHomeVisitParam(sp, ...keys) {
  return parseUrlWithCaptainFilterParam(sp, ...keys)
}

/**
 * nanny_specialization free-text keyword.
 * @param {URLSearchParams} sp
 * @param {string[]} keys
 * @returns {{ kind: DiscoveryServiceFacetParseKind, value?: string }}
 */
export function parseUrlServiceSpecializationParam(sp, ...keys) {
  for (const k of keys) {
    const raw = sp.get(k)
    if (raw == null || String(raw).trim() === '') continue
    const trimmed = String(raw).trim().slice(0, SERVICE_SPECIALIZATION_URL_MAX)
    if (!trimmed) {
      return { kind: 'inactive' }
    }
    return { kind: 'active', value: trimmed }
  }
  return { kind: 'absent' }
}
