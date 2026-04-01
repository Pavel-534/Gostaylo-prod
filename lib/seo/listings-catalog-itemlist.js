/**
 * SSR: первые N объявлений для ItemList JSON-LD (тот же движок, что GET /api/v2/listings/search).
 */
import { runListingsSearchGet } from '@/lib/api/run-listings-search-get'
import { getPublicSiteUrl } from '@/lib/site-url'
import {
  nextSearchParamsRecordToURLSearchParams,
  hasMeaningfulListingsBrowseQuery,
} from '@/lib/search/listings-page-url'

export const LISTINGS_ITEMLIST_JSON_LD_LIMIT = 18

/**
 * @param {import('next').SearchParams | Record<string, string | string[] | undefined>} searchParamsRecord
 * @returns {Promise<Array<{ id: string, title?: string }>>}
 */
export async function fetchListingsForCatalogItemList(searchParamsRecord) {
  const params = nextSearchParamsRecordToURLSearchParams(searchParamsRecord)
  params.set('limit', String(LISTINGS_ITEMLIST_JSON_LD_LIMIT))
  if (!hasMeaningfulListingsBrowseQuery(params)) {
    if (!params.has('featured')) params.set('featured', 'true')
  }

  const origin = getPublicSiteUrl()
  const internalUrl = `${origin.replace(/\/$/, '')}/__seo/listings-search?${params.toString()}`
  const res = await runListingsSearchGet(new Request(internalUrl), { skipRateLimit: true })

  if (!res.ok) return []
  try {
    const json = await res.json()
    if (!json.success || !Array.isArray(json.data?.listings)) return []
    return json.data.listings.slice(0, LISTINGS_ITEMLIST_JSON_LD_LIMIT)
  } catch {
    return []
  }
}
