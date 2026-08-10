/**
 * Stage 200.30 / 200.36 / 200.38 — Wizard geo from pin (anti-coerce).
 * Never silently substitute regions[0] / Moscow when city is unknown.
 * Header UI language/currency remains separate (guest preference ≠ listing geo).
 */

import { matchLaunchCountryIsoFromName, findLaunchGeoByCode, launchGeoLabel } from '@/lib/geo/launch-geo-index'
import {
  guessIanaTimezoneFromLatLon,
  resolveListingPlaceTimezone,
} from '@/lib/geo/listing-timezone-guess'
import { getDefaultListingBaseCurrency } from '@/lib/listing/listing-asset-currency'
import { COUNTRY_CURRENCY_TZ } from '@/lib/geo/launch-markets-seed-data'

/** @type {ReadonlyArray<{ code: string, minLat: number, maxLat: number, minLon: number, maxLon: number }>} */
const COUNTRY_BBOX = Object.freeze([
  { code: 'TH', minLat: 5.5, maxLat: 20.5, minLon: 97, maxLon: 105.7 },
  { code: 'ID', minLat: -11.5, maxLat: 6.5, minLon: 95, maxLon: 141 },
  { code: 'TR', minLat: 35.8, maxLat: 42.2, minLon: 25.5, maxLon: 45 },
  { code: 'AE', minLat: 22.5, maxLat: 26.5, minLon: 51, maxLon: 56.5 },
  { code: 'RU', minLat: 41, maxLat: 82, minLon: 19, maxLon: 180 },
])

/** City hubs for finer cascade when Nominatim names are messy — match only, never coerce. */
const HUB_BBOX = Object.freeze([
  { country: 'RU', region: 'RU-SPB', city: 'spb', minLat: 59.7, maxLat: 60.15, minLon: 29.5, maxLon: 30.75 },
  { country: 'RU', region: 'RU-MOW', city: 'moscow', minLat: 55.5, maxLat: 56.05, minLon: 37.2, maxLon: 38.0 },
  { country: 'RU', region: 'RU-KDA', city: 'sochi', minLat: 43.35, maxLat: 43.7, minLon: 39.5, maxLon: 40.0 },
  { country: 'RU', region: 'RU-TA', city: 'kazan', minLat: 55.7, maxLat: 55.9, minLon: 48.9, maxLon: 49.3 },
  { country: 'RU', region: 'RU-NVS', city: 'novosibirsk', minLat: 54.85, maxLat: 55.15, minLon: 82.7, maxLon: 83.2 },
  { country: 'RU', region: 'RU-SVE', city: 'yekaterinburg', minLat: 56.7, maxLat: 56.95, minLon: 60.4, maxLon: 60.8 },
  { country: 'RU', region: 'RU-PRI', city: 'vladivostok', minLat: 43.0, maxLat: 43.25, minLon: 131.7, maxLon: 132.0 },
  { country: 'RU', region: 'RU-ZAB', city: 'chita', minLat: 51.95, maxLat: 52.15, minLon: 113.35, maxLon: 113.7 },
  { country: 'TH', region: 'TH-PHK', city: 'phuket-city', minLat: 7.75, maxLat: 8.2, minLon: 98.2, maxLon: 98.5 },
  { country: 'TH', region: 'TH-BKK', city: 'bangkok', minLat: 13.5, maxLat: 13.95, minLon: 100.3, maxLon: 100.9 },
  { country: 'TH', region: 'TH-PTY', city: 'pattaya', minLat: 12.8, maxLat: 13.05, minLon: 100.85, maxLon: 101.0 },
])

const LAUNCH_MARKETS = new Set(['TH', 'RU', 'ID', 'AE', 'TR'])

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ё/g, 'е')
    .replace(/[^a-z0-9а-я\s-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * @param {{ countryCode?: string|null, countryName?: string|null, lat?: number|null, lon?: number|null }} p
 * @returns {string|null} ISO alpha-2
 */
export function resolveWizardCountryIso(p = {}) {
  const fromCode = String(p.countryCode || '')
    .trim()
    .toUpperCase()
    .slice(0, 2)
  if (/^[A-Z]{2}$/.test(fromCode)) return fromCode

  const name = norm(p.countryName)
  if (name) {
    const fromSeed = matchLaunchCountryIsoFromName(name)
    if (fromSeed) return fromSeed
    if (name.includes('russia') || name.includes('россий') || name === 'ru') return 'RU'
    if (name.includes('thailand') || name.includes('таиланд') || name === 'th') return 'TH'
    if (name.includes('indonesia') || name.includes('индонез')) return 'ID'
    if (name.includes('emirates') || name.includes('оаэ') || name.includes('uae')) return 'AE'
    if (name.includes('turkey') || name.includes('türkiye') || name.includes('турци')) return 'TR'
  }

  const a = Number(p.lat)
  const b = Number(p.lon)
  if (Number.isFinite(a) && Number.isFinite(b)) {
    for (const box of COUNTRY_BBOX) {
      if (a >= box.minLat && a <= box.maxLat && b >= box.minLon && b <= box.maxLon) {
        return box.code
      }
    }
  }
  return null
}

/**
 * Match region/city only when confident. Never returns regions[0].
 * @returns {{ region: { code: string }, city: { code: string } } | null}
 */
function matchRegionCity(countryCode, _haystack, lat, lon) {
  const a = Number(lat)
  const b = Number(lon)

  if (Number.isFinite(a) && Number.isFinite(b)) {
    for (const hub of HUB_BBOX) {
      if (
        hub.country === countryCode &&
        a >= hub.minLat &&
        a <= hub.maxLat &&
        b >= hub.minLon &&
        b <= hub.maxLon
      ) {
        return {
          region: { code: hub.region },
          city: { code: hub.city },
        }
      }
    }
  }

  return null
}

function currencyForIso(iso) {
  return (
    COUNTRY_CURRENCY_TZ[iso]?.currency ||
    getDefaultListingBaseCurrency(iso) ||
    'THB'
  )
}

/**
 * Place TZ: pin (offline) → catalog city/region → country default.
 * Do not let reverse country-row TZ override a pin (Stage 200.44).
 */
function timezoneForPlace(iso, lat, lon, input = {}) {
  return resolveListingPlaceTimezone({
    lat,
    lon,
    cityTimezone: input.cityTimezone,
    regionTimezone: input.regionTimezone,
    countryCode: iso,
    explicitTimezone: input.timezone,
  })
}

/**
 * @returns {{
 *   country: string
 *   region: string
 *   city: string
 *   district: string
 *   timezone: string
 *   baseCurrency: string
 *   matched: boolean
 *   cityMatched: boolean
 *   cityLabel: string
 *   launchMarket: boolean
 * } | null}
 */
export function resolveWizardGeoFromPin(input = {}) {
  const addr = input.address && typeof input.address === 'object' ? input.address : {}
  const lat = input.lat
  const lon = input.lon
  const countryCode =
    input.countryCode ||
    addr.country_code ||
    addr.countryCode ||
    null
  const countryName = input.country || addr.country || null
  const cityName = input.city || addr.city || addr.town || addr.municipality || null
  const stateName = input.state || addr.state || addr.region || null
  const districtHint =
    input.district ||
    addr.suburb ||
    addr.neighbourhood ||
    addr.city_district ||
    ''

  const serverRegion = String(input.regionCode || '').trim()
  const serverCity = String(input.cityCode || '').trim()

  const iso = resolveWizardCountryIso({
    countryCode,
    countryName,
    lat,
    lon,
  })
  if (!iso) return null

  const hay = [cityName, stateName, districtHint, input.displayName, addr.state]
    .filter(Boolean)
    .join(' ')

  let regionCode = ''
  let cityCode = ''
  let cityMatched = false

  if (serverRegion || serverCity) {
    regionCode = serverRegion
    cityCode = serverCity
    cityMatched = Boolean(serverCity)
  } else {
    const matched = matchRegionCity(iso, hay, lat, lon)
    if (matched) {
      regionCode = matched.region.code
      cityCode = matched.city.code
      cityMatched = true
    }
  }

  const tz = timezoneForPlace(iso, lat, lon, {
    timezone: input.timezone,
    cityTimezone: input.cityTimezone,
    regionTimezone: input.regionTimezone,
  })
  // Currency is always country-scoped (ADR-181); ignore stale asset currency from other markets.
  const currency = currencyForIso(iso)

  return {
    country: iso,
    region: regionCode,
    city: cityCode,
    district: String(districtHint || '').trim(),
    timezone: tz,
    baseCurrency: currency,
    matched: true,
    cityMatched,
    cityLabel: String(cityName || '').trim(),
    launchMarket: LAUNCH_MARKETS.has(iso),
  }
}

/**
 * Merge pin/geocode resolution into wizard formData (immutable).
 * Anti-coerce: unknown city → empty city code + city_label, never Moscow/default hub.
 */
export function mergeWizardFormGeoFromPin(prev, opts) {
  const lat = Number(opts.lat)
  const lon = Number(opts.lon)
  const geo = opts.geo && typeof opts.geo === 'object' ? opts.geo : {}
  const resolved = resolveWizardGeoFromPin({
    lat,
    lon,
    countryCode: geo.countryCode,
    country: geo.country,
    city: geo.city,
    state: geo.state,
    district: geo.district,
    displayName: geo.displayName,
    address: geo.address,
    regionCode: geo.regionCode,
    cityCode: geo.cityCode,
    timezone: geo.timezone,
    cityTimezone: geo.cityTimezone,
    regionTimezone: geo.regionTimezone,
    currencyCode: geo.currencyCode,
  })

  const pinTz = guessIanaTimezoneFromLatLon(lat, lon)
  /** @type {Record<string, unknown>} */
  const next = {
    ...prev,
    latitude: lat,
    longitude: lon,
    metadata: {
      ...(prev.metadata || {}),
      ...(pinTz ? { timezone: pinTz } : {}),
    },
  }

  if (geo.displayName) {
    next.address = geo.displayName
  }

  if (geo.city) {
    next.metadata = { ...next.metadata, city: geo.city, city_label: geo.city }
  }

  if (!resolved) {
    if (geo.district) next.district = geo.district
    const pinIso =
      resolveWizardCountryIso({
        countryCode: geo.countryCode,
        countryName: geo.country,
        lat,
        lon,
      }) || null
    next.metadata = {
      ...next.metadata,
      geo_city_unmatched: true,
      geo_source: geo.geoSource || 'pin',
      ...(pinIso ? { geo_pin_country: pinIso } : {}),
    }
    delete next.metadata.geo_pin_country_conflict_dismissed
    return next
  }

  const countryChanged = String(prev.country || '') !== resolved.country
  next.country = resolved.country
  next.region = resolved.region || (countryChanged ? '' : prev.region) || ''
  next.city = resolved.cityMatched ? resolved.city : ''
  next.metadata = {
    ...next.metadata,
    timezone: resolved.timezone || next.metadata.timezone,
    geo_source: geo.geoSource || 'pin',
    geo_city_unmatched: !resolved.cityMatched,
    launch_market: resolved.launchMarket,
    geo_pin_country: resolved.country,
  }
  delete next.metadata.geo_pin_country_conflict_dismissed

  if (resolved.cityLabel) {
    next.metadata.city_label = resolved.cityLabel
    next.metadata.city = resolved.cityLabel
  }

  // Stage 200.83 — surface human region label (Nominatim state / seed)
  if (next.region) {
    const seedRegion = findLaunchGeoByCode(next.region)
    next.metadata.region_label =
      String(geo.state || '').trim() ||
      launchGeoLabel('en', seedRegion, next.region) ||
      String(next.metadata.region_label || '').trim()
  } else if (geo.state) {
    next.metadata.region_label = String(geo.state).trim()
  } else if (countryChanged) {
    next.metadata.region_label = ''
  }

  if (!resolved.cityMatched) {
    if (countryChanged || !resolved.city) {
      next.city = ''
    }
  }

  if (resolved.district) {
    next.district = resolved.district
  } else if (countryChanged) {
    next.district = ''
  }

  if (!opts.baseCurrencyLocked && resolved.baseCurrency) {
    next.baseCurrency = resolved.baseCurrency
  }

  return next
}

export { LAUNCH_MARKETS }
