/**
 * Stage 200.30 — Wizard geo SSOT: map pin / geocode → country cascade + TZ + asset currency.
 * Header UI language/currency remains separate (guest preference ≠ listing geo).
 */

import {
  COUNTRY_PRESETS,
  findCountry,
  findRegion,
  findCity,
} from '@/lib/geo/country-presets'
import { guessIanaTimezoneFromLatLon } from '@/lib/geo/listing-timezone-guess'
import { defaultTimezoneForCountryCode } from '@/lib/geo/listing-timezone-ssot'
import { getDefaultListingBaseCurrency } from '@/lib/listing/listing-asset-currency'

/** @type {ReadonlyArray<{ code: string, minLat: number, maxLat: number, minLon: number, maxLon: number }>} */
const COUNTRY_BBOX = Object.freeze([
  { code: 'TH', minLat: 5.5, maxLat: 20.5, minLon: 97, maxLon: 105.7 },
  { code: 'ID', minLat: -11.5, maxLat: 6.5, minLon: 95, maxLon: 141 },
  { code: 'TR', minLat: 35.8, maxLat: 42.2, minLon: 25.5, maxLon: 45 },
  // Coarse European + Asian Russia (wizard presets only cover major hubs)
  { code: 'RU', minLat: 41, maxLat: 82, minLon: 19, maxLon: 180 },
])

/** City hubs for finer cascade when Nominatim names are messy. */
const HUB_BBOX = Object.freeze([
  { country: 'RU', region: 'RU-SPB', city: 'spb', minLat: 59.7, maxLat: 60.15, minLon: 29.5, maxLon: 30.75 },
  { country: 'RU', region: 'RU-MOW', city: 'moscow', minLat: 55.5, maxLat: 56.05, minLon: 37.2, maxLon: 38.0 },
  { country: 'RU', region: 'RU-KDA', city: 'sochi', minLat: 43.35, maxLat: 43.7, minLon: 39.5, maxLon: 40.0 },
  { country: 'RU', region: 'RU-TA', city: 'kazan', minLat: 55.7, maxLat: 55.9, minLon: 48.9, maxLon: 49.3 },
  { country: 'TH', region: 'TH-PHK', city: 'phuket-city', minLat: 7.75, maxLat: 8.2, minLon: 98.2, maxLon: 98.5 },
  { country: 'TH', region: 'TH-BKK', city: 'bangkok', minLat: 13.5, maxLat: 13.95, minLon: 100.3, maxLon: 100.9 },
  { country: 'TH', region: 'TH-PTY', city: 'pattaya', minLat: 12.8, maxLat: 13.05, minLon: 100.85, maxLon: 101.0 },
])

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

function labelMatch(hayNorm, item) {
  if (!item?.labels || !hayNorm) return false
  for (const v of Object.values(item.labels)) {
    const n = norm(v)
    if (n.length >= 3 && (hayNorm.includes(n) || n.includes(hayNorm.slice(0, Math.min(hayNorm.length, 24))))) {
      return true
    }
  }
  return false
}

/**
 * @param {{ countryCode?: string|null, countryName?: string|null, lat?: number|null, lon?: number|null }} p
 * @returns {string|null} ISO alpha-2 present in COUNTRY_PRESETS
 */
export function resolveWizardCountryIso(p = {}) {
  const fromCode = String(p.countryCode || '')
    .trim()
    .toUpperCase()
    .slice(0, 2)
  if (fromCode && findCountry(fromCode)) return fromCode

  const name = norm(p.countryName)
  if (name) {
    for (const c of COUNTRY_PRESETS) {
      if (labelMatch(name, c) || Object.values(c.labels || {}).some((l) => norm(l) === name)) {
        return c.code
      }
    }
    if (name.includes('russia') || name.includes('россий') || name === 'ru') return findCountry('RU') ? 'RU' : null
    if (name.includes('thailand') || name.includes('таиланд') || name === 'th') return findCountry('TH') ? 'TH' : null
  }

  const a = Number(p.lat)
  const b = Number(p.lon)
  if (Number.isFinite(a) && Number.isFinite(b)) {
    for (const box of COUNTRY_BBOX) {
      if (a >= box.minLat && a <= box.maxLat && b >= box.minLon && b <= box.maxLon && findCountry(box.code)) {
        return box.code
      }
    }
  }
  return null
}

/**
 * @param {string} countryCode
 * @param {string} haystack
 * @param {number|null|undefined} lat
 * @param {number|null|undefined} lon
 */
function matchRegionCity(countryCode, haystack, lat, lon) {
  const country = findCountry(countryCode)
  if (!country) return null

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
        const region = findRegion(countryCode, hub.region)
        const city = findCity(countryCode, hub.region, hub.city)
        if (region && city) return { region, city }
      }
    }
  }

  const hay = norm(haystack)
  if (hay) {
    for (const region of country.regions) {
      for (const city of region.cities) {
        if (labelMatch(hay, city) || hay.includes(norm(city.code))) {
          return { region, city }
        }
      }
      if (labelMatch(hay, region)) {
        const city = region.cities[0]
        if (city) return { region, city }
      }
    }
  }

  const region = country.regions[0]
  const city = region?.cities?.[0]
  if (!region || !city) return null
  return { region, city }
}

/**
 * @param {{
 *   lat?: number|null
 *   lon?: number|null
 *   countryCode?: string|null
 *   country?: string|null
 *   city?: string|null
 *   state?: string|null
 *   district?: string|null
 *   displayName?: string|null
 *   address?: Record<string, string>|null
 * }} input
 * @returns {{
 *   country: string
 *   region: string
 *   city: string
 *   district: string
 *   timezone: string
 *   baseCurrency: string
 *   matched: boolean
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
  const matched = matchRegionCity(iso, hay, lat, lon)
  if (!matched) return null

  const tz =
    guessIanaTimezoneFromLatLon(lat, lon) ||
    defaultTimezoneForCountryCode(iso) ||
    'Asia/Bangkok'

  return {
    country: iso,
    region: matched.region.code,
    city: matched.city.code,
    district: String(districtHint || '').trim(),
    timezone: tz,
    baseCurrency: getDefaultListingBaseCurrency(iso),
    matched: true,
  }
}

/**
 * Merge pin/geocode resolution into wizard formData (immutable).
 * @param {object} prev
 * @param {{
 *   lat: number
 *   lon: number
 *   geo?: object|null
 *   baseCurrencyLocked?: boolean
 * }} opts
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
  })

  const guessedTz = guessIanaTimezoneFromLatLon(lat, lon)
  /** @type {Record<string, unknown>} */
  const next = {
    ...prev,
    latitude: lat,
    longitude: lon,
    metadata: {
      ...(prev.metadata || {}),
      ...(guessedTz ? { timezone: guessedTz } : {}),
    },
  }

  if (geo.city) {
    next.metadata = { ...next.metadata, city: geo.city }
  }

  if (!resolved) {
    if (geo.district) next.district = geo.district
    return next
  }

  const countryChanged = String(prev.country || '') !== resolved.country
  next.country = resolved.country
  next.region = resolved.region
  next.city = resolved.city
  next.metadata = {
    ...next.metadata,
    timezone: resolved.timezone || next.metadata.timezone,
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
