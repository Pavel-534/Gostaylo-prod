/**
 * RSC bootstrap SSOT for `/listings` — deduped per request via `React.cache`.
 * Stage 171.26 (P0.2) — categories + first-page search for TanStack dehydrate.
 */

import { cache } from 'react'
import { fetchCategoriesSeoSnapshot } from '@/lib/seo/listings-catalog-categories-snapshot'
import { fetchListingsCountForCatalogSeo } from '@/lib/seo/listings-catalog-listing-count'
import {
  buildCatalogSearchKeyParamsFromUrl,
  serializeCatalogSearchParamsKey,
} from '@/lib/catalog/build-catalog-bootstrap-search-params'
import { mapCategoriesFromSeoSnapshot } from '@/lib/catalog/map-categories-seo-snapshot'
import { resolveCatalogSearchServer } from '@/lib/catalog/run-catalog-search-server'
import {
  fetchListingsForCatalogItemList,
  LISTINGS_ITEMLIST_JSON_LD_LIMIT,
} from '@/lib/seo/listings-catalog-itemlist'
import {
  hasMeaningfulListingsBrowseQuery,
  nextSearchParamsRecordToURLSearchParams,
} from '@/lib/search/listings-page-url'

/** Default display currency segment for catalog search queryKey (client may override after mount). */
export const CATALOG_BOOTSTRAP_DISPLAY_CURRENCY = 'THB'

/**
 * @typedef {Object} CatalogBootstrapResult
 * @property {ReturnType<typeof mapCategoriesFromSeoSnapshot>} categories
 * @property {Array<{ id: string, slug: string, name: string, parent_id?: string | null, name_i18n?: object | null, wizard_profile?: string | null }>} categorySeoRows
 * @property {ReturnType<typeof buildCatalogSearchKeyParamsFromUrl>} searchKeyParams
 * @property {{ listings: object[], meta: object | null }} searchResult
 * @property {string} displayCurrency
 * @property {Array<{ id: string, title?: string }>} itemListListings
 * @property {number | null} listingCountForSeo
 * @property {string} searchParamsKey
 */

/**
 * @param {import('next').SearchParams | Record<string, string | string[] | undefined>} searchParamsRecord
 * @returns {Promise<CatalogBootstrapResult>}
 */
async function loadCatalogBootstrap(searchParamsRecord) {
  const searchParamsKey = serializeCatalogSearchParamsKey(searchParamsRecord)
  const sp = nextSearchParamsRecordToURLSearchParams(searchParamsRecord)

  const [categorySeoRows, listingCountForSeo] = await Promise.all([
    fetchCategoriesSeoSnapshot(),
    fetchListingsCountForCatalogSeo(searchParamsRecord),
  ])

  const categories = mapCategoriesFromSeoSnapshot(categorySeoRows)
  const searchKeyParams = buildCatalogSearchKeyParamsFromUrl(sp, categories)
  const searchResult = await resolveCatalogSearchServer(searchKeyParams)

  let itemListListings
  if (hasMeaningfulListingsBrowseQuery(sp)) {
    itemListListings = (searchResult.listings || []).slice(0, LISTINGS_ITEMLIST_JSON_LD_LIMIT)
  } else {
    itemListListings = await fetchListingsForCatalogItemList(searchParamsRecord)
  }

  return {
    categories,
    categorySeoRows,
    searchKeyParams,
    searchResult,
    displayCurrency: CATALOG_BOOTSTRAP_DISPLAY_CURRENCY,
    itemListListings,
    listingCountForSeo,
    searchParamsKey,
  }
}

/**
 * Cached catalog bootstrap — pass stable `searchParamsKey` from {@link serializeCatalogSearchParamsKey}.
 *
 * @param {string} searchParamsKey — sorted query string (may be empty)
 */
export const getCachedCatalogBootstrap = cache(async (searchParamsKey) => {
  const sp = new URLSearchParams(searchParamsKey)
  const record = Object.fromEntries(sp.entries())
  return loadCatalogBootstrap(record)
})

/**
 * Convenience for RSC pages: accepts Next `searchParams` object.
 *
 * @param {import('next').SearchParams | Record<string, string | string[] | undefined>} searchParamsRecord
 */
export async function getCatalogBootstrapFromSearchParams(searchParamsRecord) {
  const key = serializeCatalogSearchParamsKey(searchParamsRecord)
  return getCachedCatalogBootstrap(key)
}
