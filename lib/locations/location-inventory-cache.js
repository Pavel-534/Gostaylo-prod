/**
 * Stage 158 — ACTIVE listing inventory counts for location suggest ranking.
 * In-memory TTL cache (120s); uses Set per bucket to avoid double-counting.
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
 * @param {Array<{ id: string, country_code?: string | null, region_code?: string | null, city_code?: string | null, district?: string | null, title?: string, description?: string }>} rows
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
 * @returns {Promise<LocationInventoryIndex>}
 */
export async function getLocationInventoryIndex() {
  if (cache.index && Date.now() - cache.ts < CACHE_TTL_MS) {
    return cache.index
  }

  if (!supabaseAdmin) {
    return buildLocationInventoryIndex([])
  }

  const { data, error } = await supabaseAdmin
    .from('listings')
    .select('id, country_code, region_code, city_code, district, title, description')
    .eq('status', 'ACTIVE')

  if (error) {
    console.error('[location-inventory-cache]', error.message)
    return buildLocationInventoryIndex([])
  }

  const index = buildLocationInventoryIndex(data || [])
  cache = { index, ts: Date.now() }
  return index
}

/** Test-only: reset cache between unit tests. */
export function resetLocationInventoryCacheForTests() {
  cache = { index: null, ts: 0 }
}
