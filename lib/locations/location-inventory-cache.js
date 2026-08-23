/**
 * Stage 158 — ACTIVE listing inventory counts for location suggest ranking.
 * Stage 177.5.2 — SQL GROUP BY via listings_location_inventory_counts_v1 (no raw card pull).
 * In-memory TTL cache (120s); Phuket rollup + E2E exclusion live in the RPC.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { isExcludedFromPublicCatalog } from '@/lib/e2e/test-listing-cleanup'
import { PHUKET_DISTRICTS_CANON } from '@/lib/locations/phuket-districts-canonical'

const CACHE_TTL_MS = 120_000
const PHUKET_DISTRICT_SET = new Set(PHUKET_DISTRICTS_CANON)

/** @type {{ index: LocationInventoryIndex | null, ts: number }} */
let cache = { index: null, ts: 0 }

/**
 * @typedef {object} LocationInventoryIndex
 * @property {(code: string) => number} countryCount
 * @property {(code: string) => number} regionCount
 * @property {(code: string) => number} cityCount
 * @property {(name: string) => number} districtCount
 */

/**
 * @typedef {{ level: string, code: string, listing_count: number|string|bigint }} LocationInventoryAggregateRow
 */

/**
 * @param {Map<string, Set<string>>} map
 * @param {string} key
 * @param {string} id
 */
function addId(map, key, id) {
  if (!key || !id) return
  if (!map.has(key)) map.set(key, new Set())
  map.get(key).add(id)
}

/**
 * Reference builder from raw listing rows (unit tests / parity vs SQL aggregates).
 * @param {Array<{ id: string, country_code?: string | null, region_code?: string | null, city_code?: string | null, district?: string | null, title?: string, description?: string, metadata?: object }>} rows
 * @returns {LocationInventoryIndex}
 */
export function buildLocationInventoryIndex(rows) {
  const country = new Map()
  const region = new Map()
  const city = new Map()
  const district = new Map()

  for (const row of rows || []) {
    if (!row?.id || isExcludedFromPublicCatalog(row)) continue

    const id = String(row.id)
    if (row.country_code) addId(country, row.country_code, id)
    if (row.region_code) addId(region, row.region_code, id)
    if (row.city_code) addId(city, row.city_code, id)

    const dist = row.district?.trim()
    if (dist) {
      addId(district, dist, id)
      if (PHUKET_DISTRICT_SET.has(dist)) {
        addId(city, 'phuket-city', id)
        addId(region, 'TH-PHK', id)
        addId(country, 'TH', id)
      }
    }
  }

  const size = (map, key) => map.get(key)?.size ?? 0

  return {
    countryCount: (code) => size(country, code),
    regionCount: (code) => size(region, code),
    cityCount: (code) => size(city, code),
    districtCount: (name) => size(district, name),
  }
}

/**
 * Hot-path builder from RPC aggregate rows.
 * @param {LocationInventoryAggregateRow[]|null|undefined} rows
 * @returns {LocationInventoryIndex}
 */
export function buildLocationInventoryIndexFromAggregates(rows) {
  const country = new Map()
  const region = new Map()
  const city = new Map()
  const district = new Map()

  for (const row of rows || []) {
    const level = String(row?.level || '').trim()
    const code = String(row?.code || '').trim()
    const count = Number(row?.listing_count)
    if (!level || !code || !Number.isFinite(count) || count <= 0) continue

    if (level === 'country') country.set(code, count)
    else if (level === 'region') region.set(code, count)
    else if (level === 'city') city.set(code, count)
    else if (level === 'district') district.set(code, count)
  }

  return {
    countryCount: (code) => country.get(code) ?? 0,
    regionCount: (code) => region.get(code) ?? 0,
    cityCount: (code) => city.get(code) ?? 0,
    districtCount: (name) => district.get(name) ?? 0,
  }
}

/**
 * Pure JS mirror of RPC grouping (for unit parity without DB).
 * @param {Array<{ id: string, country_code?: string | null, region_code?: string | null, city_code?: string | null, district?: string | null, title?: string, description?: string, metadata?: object }>} rows
 * @param {readonly string[]} [phuketDistricts]
 * @returns {LocationInventoryAggregateRow[]}
 */
export function simulateLocationInventoryAggregates(rows, phuketDistricts = PHUKET_DISTRICTS_CANON) {
  const phuket = new Set(phuketDistricts)
  /** @type {Map<string, Set<string>>} */
  const country = new Map()
  /** @type {Map<string, Set<string>>} */
  const region = new Map()
  /** @type {Map<string, Set<string>>} */
  const city = new Map()
  /** @type {Map<string, Set<string>>} */
  const district = new Map()

  for (const row of rows || []) {
    if (!row?.id || isExcludedFromPublicCatalog(row)) continue
    const id = String(row.id)
    const countryCode = row.country_code ? String(row.country_code).trim() : ''
    const regionCode = row.region_code ? String(row.region_code).trim() : ''
    const cityCode = row.city_code ? String(row.city_code).trim() : ''
    const dist = row.district?.trim() || ''

    if (countryCode) addId(country, countryCode, id)
    if (regionCode) addId(region, regionCode, id)
    if (cityCode) addId(city, cityCode, id)
    if (dist) {
      addId(district, dist, id)
      if (phuket.has(dist)) {
        addId(city, 'phuket-city', id)
        addId(region, 'TH-PHK', id)
        addId(country, 'TH', id)
      }
    }
  }

  /** @param {string} level @param {Map<string, Set<string>>} map */
  const flatten = (level, map) =>
    [...map.entries()].map(([code, set]) => ({
      level,
      code,
      listing_count: set.size,
    }))

  return [
    ...flatten('country', country),
    ...flatten('region', region),
    ...flatten('city', city),
    ...flatten('district', district),
  ]
}

/**
 * @returns {Promise<LocationInventoryIndex>}
 */
export async function getLocationInventoryIndex() {
  if (cache.index && Date.now() - cache.ts < CACHE_TTL_MS) {
    return cache.index
  }

  if (!supabaseAdmin) {
    return buildLocationInventoryIndexFromAggregates([])
  }

  const { data, error } = await supabaseAdmin.rpc('listings_location_inventory_counts_v1', {
    p_phuket_districts: [...PHUKET_DISTRICTS_CANON],
  })

  if (error) {
    console.error('[location-inventory-cache]', error.message)
    return buildLocationInventoryIndexFromAggregates([])
  }

  const index = buildLocationInventoryIndexFromAggregates(data || [])
  cache = { index, ts: Date.now() }
  return index
}

/** Test-only: reset cache between unit tests. */
export function resetLocationInventoryCacheForTests() {
  cache = { index: null, ts: 0 }
}
