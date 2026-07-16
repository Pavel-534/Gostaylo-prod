/**
 * Server-side catalog search — same engine as GET /api/v2/listings/search (no HTTP hop).
 */

import { runListingsSearchGet } from '@/lib/api/run-listings-search-get'
import { getPublicSiteUrl } from '@/lib/site-url'
import { LISTINGS_SEARCH_API_PATH } from '@/lib/search-endpoints'
import { catalogSearchKeyParamsToUrlSearchParams } from '@/lib/catalog/build-catalog-search-params'

/**
 * @param {ReturnType<typeof import('@/lib/catalog/build-catalog-search-params').buildCatalogSearchKeyParams>} keyParams
 * @returns {Promise<{ listings: object[], meta: object | null }>}
 */
async function runCatalogSearchOnce(keyParams) {
  const urlParams = catalogSearchKeyParamsToUrlSearchParams(keyParams)
  const origin = getPublicSiteUrl().replace(/\/$/, '')
  const internalUrl = `${origin}${LISTINGS_SEARCH_API_PATH}?${urlParams.toString()}`
  const res = await runListingsSearchGet(new Request(internalUrl), {
    skipRateLimit: true,
    isLite: true,
  })

  if (!res.ok) {
    return { listings: [], meta: null }
  }

  try {
    const json = await res.json()
    if (!json.success) return { listings: [], meta: null }
    return {
      listings: Array.isArray(json.data?.listings) ? json.data.listings : [],
      meta: json.data?.meta ?? null,
    }
  } catch {
    return { listings: [], meta: null }
  }
}

/**
 * Parity with client `fetchCatalogSearch` (date-mismatch soft fallback).
 *
 * @param {ReturnType<typeof import('@/lib/catalog/build-catalog-search-params').buildCatalogSearchKeyParams>} keyParams
 */
export async function resolveCatalogSearchServer(keyParams) {
  const { hasDates, hasBounds, hasExtra } = keyParams._flags || {}

  let { listings, meta } = await runCatalogSearchOnce(keyParams)

  if (listings.length === 0 && hasDates && !keyParams.cursor) {
    const fallbackKeyParams = {
      ...keyParams,
      checkIn: null,
      checkOut: null,
      checkInTime: null,
      checkOutTime: null,
      _flags: {
        ...(keyParams._flags || {}),
        hasDates: false,
        intervalMode: false,
      },
    }
    try {
      const fallbackResult = await runCatalogSearchOnce(fallbackKeyParams)
      const fallbackListings = fallbackResult.listings ?? []
      if (fallbackListings.length > 0) {
        listings = fallbackListings.map((l) => ({ ...l, is_availability_mismatch: true }))
        meta = { ...(fallbackResult.meta ?? {}), isSoftFallback: true }
      }
    } catch {
      /* empty result */
    }
  }

  void hasBounds
  void hasExtra

  return { listings, meta }
}
