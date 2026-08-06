/**
 * Stage 200.51 — wizard geo cascade reset SSOT (create + edit).
 *
 * Camera (`mapCenter`) is UI-only — callers `setMapCenter` separately.
 * Listing pin (lat/lng) is cleared on country / region / city change and never
 * auto-written to a capital or city centroid (anti-coerce). User places pin
 * on the map after cascade fields are set.
 *
 * @see clearWizardFormPin — pin-only clear (conflict CTA)
 */

import { COUNTRY_CURRENCY_TZ } from '@/lib/geo/launch-markets-seed-data'
import { resolveListingPlaceTimezone } from '@/lib/geo/listing-timezone-guess'
import { getDefaultListingBaseCurrency } from '@/lib/listing/listing-asset-currency'
import { clearWizardFormPin } from '@/lib/geo/wizard-pin-country-conflict'

/**
 * @param {Record<string, unknown>} prev
 * @param {{
 *   countryCode: string,
 *   nextCurrency?: string|null,
 *   baseCurrencyLocked?: boolean,
 *   timezone?: string|null,
 * }} opts
 */
export function applyWizardCountryCascadeReset(prev, opts = {}) {
  const code = String(opts.countryCode || '')
    .trim()
    .toUpperCase()
    .slice(0, 2)
  const locked = opts.baseCurrencyLocked === true
  const nextCurrency =
    opts.nextCurrency ||
    COUNTRY_CURRENCY_TZ[code]?.currency ||
    getDefaultListingBaseCurrency(code)

  let next = {
    ...prev,
    country: code,
    region: '',
    city: '',
    district: '',
    address: '',
    metadata: {
      ...(prev.metadata && typeof prev.metadata === 'object' ? prev.metadata : {}),
      city_label: '',
      city: '',
      geo_city_unmatched: false,
      geo_pin_country_conflict_dismissed: false,
    },
  }

  if (!locked && nextCurrency) {
    next.baseCurrency = nextCurrency
  }

  const tz =
    opts.timezone ||
    resolveListingPlaceTimezone({
      countryCode: code,
    })

  return clearWizardFormPin(next, { timezone: tz })
}

/**
 * Region change: clear city/district/address/pin; keep country.
 * @param {Record<string, unknown>} prev
 * @param {{
 *   regionCode?: string,
 *   regionTimezone?: string|null,
 *   viewportLat?: number|null,
 *   viewportLon?: number|null,
 *   timezone?: string|null,
 * }} opts
 */
export function applyWizardRegionCascadeReset(prev, opts = {}) {
  const countryCode = String(prev.country || '')
    .trim()
    .toUpperCase()
    .slice(0, 2)

  let next = {
    ...prev,
    region: opts.regionCode || '',
    city: '',
    district: '',
    address: '',
    metadata: {
      ...(prev.metadata && typeof prev.metadata === 'object' ? prev.metadata : {}),
      city_label: '',
      city: '',
      geo_city_unmatched: false,
      geo_pin_country_conflict_dismissed: false,
    },
  }

  const tz =
    opts.timezone ||
    resolveListingPlaceTimezone({
      countryCode,
      regionTimezone: opts.regionTimezone || null,
      lat: opts.viewportLat,
      lon: opts.viewportLon,
    })

  return clearWizardFormPin(next, { timezone: tz })
}

/**
 * City select (suggest or manual): set city fields, clear district/address/pin.
 * Viewport lat/lon may inform TZ only — not stored as listing pin.
 *
 * @param {Record<string, unknown>} prev
 * @param {{
 *   cityCode?: string|null,
 *   cityLabel: string,
 *   regionCode?: string|null,
 *   unmatched?: boolean,
 *   cityTimezone?: string|null,
 *   viewportLat?: number|null,
 *   viewportLon?: number|null,
 *   clearPin?: boolean,
 *   clearAddress?: boolean,
 *   timezone?: string|null,
 * }} opts
 */
export function applyWizardCityCascadeSelect(prev, opts = {}) {
  const label = String(opts.cityLabel || '').trim()
  const cityCode = opts.cityCode ? String(opts.cityCode) : ''
  const unmatched = opts.unmatched === true || !cityCode
  const clearPin = opts.clearPin !== false
  const clearAddress = opts.clearAddress !== false
  const countryCode = String(prev.country || '')
    .trim()
    .toUpperCase()
    .slice(0, 2)

  let next = {
    ...prev,
    district: '',
    address: clearAddress ? '' : prev.address || '',
    city: cityCode,
    metadata: {
      ...(prev.metadata && typeof prev.metadata === 'object' ? prev.metadata : {}),
      city_label: label,
      city: label,
      geo_city_unmatched: unmatched,
      geo_pin_country_conflict_dismissed: false,
    },
  }

  if (opts.regionCode) {
    next.region = String(opts.regionCode)
  }

  const tz =
    opts.timezone ||
    resolveListingPlaceTimezone({
      countryCode,
      cityTimezone: opts.cityTimezone || null,
      lat: opts.viewportLat,
      lon: opts.viewportLon,
    })

  if (clearPin) {
    return clearWizardFormPin(next, { timezone: tz })
  }

  next.metadata = { ...next.metadata, timezone: tz }
  return next
}
