/**
 * Stage 177.3 — SSOT parse/normalize transport & yacht discovery facet URL values.
 */

import { normalizeDiscoveryPropertyTypeSlug } from '@/lib/api/search/discovery-jsonb-text-filter'
import { parseUrlMinIntFilterParam } from '@/lib/search/discovery-parse-params'

/** Wizard + UI select values (`category-form-schema`, SearchFiltersDialog). */
export const DISCOVERY_TRANSMISSION_SLUGS = new Set(['automatic', 'manual', 'cvt'])

/** Wizard fuel_type select values. */
export const DISCOVERY_FUEL_TYPE_SLUGS = new Set(['petrol', 'diesel', 'electric', 'hybrid'])

/**
 * @param {string | null | undefined} raw
 * @returns {{ value: string | null, invalid: boolean }}
 */
export function normalizeDiscoveryTransmissionSlug(raw) {
  if (raw == null || String(raw).trim() === '') {
    return { value: null, invalid: false }
  }
  const slug = String(raw).trim().toLowerCase()
  if (slug === 'any' || slug === 'unset') {
    return { value: null, invalid: false }
  }
  if (!DISCOVERY_TRANSMISSION_SLUGS.has(slug)) {
    return { value: null, invalid: true }
  }
  return { value: slug, invalid: false }
}

/**
 * @param {string | null | undefined} raw
 * @returns {{ value: string | null, invalid: boolean }}
 */
export function normalizeDiscoveryFuelTypeSlug(raw) {
  if (raw == null || String(raw).trim() === '') {
    return { value: null, invalid: false }
  }
  const slug = String(raw).trim().toLowerCase()
  if (slug === 'any' || slug === 'unset') {
    return { value: null, invalid: false }
  }
  if (!DISCOVERY_FUEL_TYPE_SLUGS.has(slug)) {
    return { value: null, invalid: true }
  }
  return { value: slug, invalid: false }
}

/**
 * Vessel type slug — same rules as housing.property_type.
 * @param {string | null | undefined} raw
 * @returns {{ value: string | null, invalid: boolean }}
 */
export function normalizeDiscoveryVesselTypeSlug(raw) {
  return normalizeDiscoveryPropertyTypeSlug(raw)
}

/**
 * @typedef {'absent'|'inactive'|'active'|'invalid'} DiscoveryEngineCcParseKind
 */

/**
 * engine_cc_min: absent, <=0 inactive, >0 active.
 * @param {URLSearchParams} sp
 * @param {string[]} keys
 * @returns {{ kind: DiscoveryEngineCcParseKind, value?: number }}
 */
export function parseUrlEngineCcMinParam(sp, ...keys) {
  for (const k of keys) {
    const raw = sp.get(k)
    if (raw == null || raw === '') continue
    const n = parseFloat(String(raw))
    if (!Number.isFinite(n)) return { kind: 'invalid' }
    if (n <= 0) return { kind: 'inactive' }
    return { kind: 'active', value: n }
  }
  return { kind: 'absent' }
}

/**
 * with_captain: only explicit true activates; false = inactive.
 * @param {URLSearchParams} sp
 * @param {string[]} keys
 * @returns {{ kind: 'absent'|'inactive'|'active'|'invalid' }}
 */
export function parseUrlWithCaptainFilterParam(sp, ...keys) {
  for (const k of keys) {
    const raw = sp.get(k)
    if (raw == null || raw === '') continue
    const n = String(raw).trim().toLowerCase()
    if (['1', 'true', 'yes', 'on'].includes(n)) return { kind: 'active' }
    if (['0', 'false', 'no', 'off'].includes(n)) return { kind: 'inactive' }
    return { kind: 'invalid' }
  }
  return { kind: 'absent' }
}

/**
 * @param {URLSearchParams} sp
 * @param {string[]} keys
 * @returns {{ kind: 'absent'|'inactive'|'active'|'invalid', value?: number }}
 */
export function parseUrlCabinsMinParam(sp, ...keys) {
  return parseUrlMinIntFilterParam(sp, ...keys)
}
