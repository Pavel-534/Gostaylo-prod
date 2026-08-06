/**
 * Stage 200.46 — detect wizard pin vs selected country conflict (warn_block_next).
 */

import { resolveWizardCountryIso } from '@/lib/geo/wizard-geo-from-pin'

export const PIN_COUNTRY_CONFLICT_POLICY = 'warn_block_next'

/**
 * @param {{
 *   country?: string|null,
 *   lat?: number|null,
 *   lon?: number|null,
 *   pinCountryCode?: string|null,
 *   dismissed?: boolean,
 * }} opts
 * @returns {{
 *   conflict: boolean,
 *   pinCountry: string|null,
 *   formCountry: string|null,
 *   blocked: boolean,
 * }}
 */
export function detectPinCountryConflict(opts = {}) {
  const formCountry = String(opts.country || '')
    .trim()
    .toUpperCase()
    .slice(0, 2)
  const lat = Number(opts.lat)
  const lon = Number(opts.lon)
  const hasPin = Number.isFinite(lat) && Number.isFinite(lon)

  if (!hasPin || !/^[A-Z]{2}$/.test(formCountry)) {
    return { conflict: false, pinCountry: null, formCountry: formCountry || null, blocked: false }
  }

  const fromMeta = String(opts.pinCountryCode || '')
    .trim()
    .toUpperCase()
    .slice(0, 2)
  const inferred = resolveWizardCountryIso({
    countryCode: /^[A-Z]{2}$/.test(fromMeta) ? fromMeta : null,
    lat,
    lon,
  })
  const pinCountry = /^[A-Z]{2}$/.test(fromMeta)
    ? fromMeta
    : inferred && /^[A-Z]{2}$/.test(inferred)
      ? inferred
      : null

  if (!pinCountry) {
    return { conflict: false, pinCountry: null, formCountry, blocked: false }
  }

  const conflict = pinCountry !== formCountry
  const dismissed = opts.dismissed === true
  return {
    conflict,
    pinCountry,
    formCountry,
    blocked: conflict && !dismissed && PIN_COUNTRY_CONFLICT_POLICY === 'warn_block_next',
  }
}

/**
 * Clear map pin from wizard formData (keep country/city labels).
 * @param {Record<string, unknown>} prev
 * @param {{ timezone?: string|null }} [opts]
 */
export function clearWizardFormPin(prev, opts = {}) {
  const nextMeta = { ...(prev.metadata || {}) }
  delete nextMeta.geo_pin_country
  delete nextMeta.geo_pin_country_conflict_dismissed
  if (opts.timezone) {
    nextMeta.timezone = opts.timezone
  }
  return {
    ...prev,
    latitude: null,
    longitude: null,
    metadata: nextMeta,
  }
}
