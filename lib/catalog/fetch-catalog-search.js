import { LISTINGS_SEARCH_API_PATH } from '@/lib/search-endpoints'
import { queryFetchJson } from '@/lib/api/query-fetch'
import { trackProductEvent, ProductAnalyticsEvents } from '@/lib/analytics/product-analytics.js'
import { appendExtraFiltersToParams } from '@/lib/search/listings-page-url'
import { catalogSearchKeyParamsToUrlSearchParams } from '@/lib/catalog/build-catalog-search-params'

/**
 * @param {ReturnType<typeof buildCatalogSearchKeyParams>} keyParams
 * @returns {Promise<{ listings: object[], meta: object | null }>}
 */
export async function fetchCatalogSearch(keyParams) {
  const { _flags, category, q } = keyParams
  const { hasDates, hasBounds, hasExtra } = _flags || {}
  const urlParams = catalogSearchKeyParamsToUrlSearchParams(keyParams)
  const path = `${LISTINGS_SEARCH_API_PATH}?${urlParams.toString()}`

  const data = await queryFetchJson(path)
  let listings = data?.listings ?? []
  let meta = data?.meta ?? null

  if (listings.length === 0 && hasDates && !keyParams.cursor) {
    const fallbackParams = new URLSearchParams()
    if (category && category !== 'all') fallbackParams.set('category', category)
    if (keyParams.where && keyParams.where !== 'all') fallbackParams.set('where', keyParams.where)
    if (q) fallbackParams.set('q', q)
    fallbackParams.set('limit', String(keyParams.limit || '100'))
    if (keyParams.extraFilters) {
      appendExtraFiltersToParams(fallbackParams, keyParams.extraFilters)
    }
    try {
      const fallbackData = await queryFetchJson(
        `${LISTINGS_SEARCH_API_PATH}?${fallbackParams.toString()}`,
      )
      const fallbackListings = fallbackData?.listings ?? []
      if (fallbackListings.length > 0) {
        listings = fallbackListings.map((l) => ({ ...l, is_availability_mismatch: true }))
        meta = { ...(fallbackData?.meta ?? {}), isSoftFallback: true }
      }
    } catch {
      /* показываем пустой результат */
    }
  }

  void trackProductEvent(ProductAnalyticsEvents.SEARCH, {
    category: category || undefined,
    where: keyParams.where !== 'all' ? keyParams.where : undefined,
    results: listings.length,
    semantic: keyParams.semantic === '1' || undefined,
  })

  return { listings, meta }
}
