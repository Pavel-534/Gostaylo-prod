import { queryFetchJson } from '@/lib/api/query-fetch'
import { catalogSearchKeyParamsToUrlSearchParams } from '@/lib/catalog/build-catalog-search-params'

export const MAP_PINS_API_PATH = '/api/v2/search/map-pins'

/**
 * @typedef {object} MapPin
 * @property {string} id
 * @property {number} lat
 * @property {number} lng
 * @property {number|null} price
 * @property {string} status
 */

/**
 * @typedef {object} MapCluster
 * @property {number} clusterId
 * @property {number} count
 * @property {number} lat
 * @property {number} lng
 * @property {number|null} minPrice
 * @property {string[]} listingIds
 */

/**
 * @param {ReturnType<typeof import('@/lib/catalog/build-catalog-search-params').buildCatalogSearchKeyParams>} keyParams
 * @returns {Promise<{ mode: 'pins'|'clusters', pins: MapPin[], clusters: MapCluster[], meta: object|null }>}
 */
export async function fetchMapPins(keyParams) {
  const urlParams = catalogSearchKeyParamsToUrlSearchParams({
    ...keyParams,
    limit: String(keyParams?.limit || '500'),
  })
  const payload = await queryFetchJson(`${MAP_PINS_API_PATH}?${urlParams.toString()}`)
  return {
    mode: payload?.mode === 'clusters' ? 'clusters' : 'pins',
    pins: Array.isArray(payload?.pins) ? payload.pins : [],
    clusters: Array.isArray(payload?.clusters) ? payload.clusters : [],
    meta: payload?.meta ?? null,
  }
}
