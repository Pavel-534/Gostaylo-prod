/**
 * Server prefetch helpers for catalog TanStack Query hydration.
 * Stage 171.26 (P0.2) — mirrors client `usePublicCategoriesQuery` + `useListingsFetch`.
 */

import { dehydrate } from '@tanstack/react-query'
import { createServerQueryClient } from '@/lib/query-prefetch/create-server-query-client'
import { queryKeys } from '@/lib/query-keys'
import {
  CATALOG_CATEGORIES_STALE_MS,
  CATALOG_SEARCH_SIMPLE_STALE_MS,
} from '@/lib/query-prefetch/catalog-query-constants'

export {
  CATALOG_CATEGORIES_STALE_MS,
  CATALOG_SEARCH_SIMPLE_STALE_MS,
} from '@/lib/query-prefetch/catalog-query-constants'

/**
 * @param {import('@/lib/listing/get-cached-catalog-bootstrap.js').CatalogBootstrapResult} bootstrap
 * @returns {Promise<import('@tanstack/react-query').DehydratedState>}
 */
export async function buildCatalogDehydratedState(bootstrap) {
  const qc = createServerQueryClient()

  if (bootstrap?.categories?.length) {
    await qc.prefetchQuery({
      queryKey: queryKeys.public.categories(),
      queryFn: () => Promise.resolve(bootstrap.categories),
      staleTime: CATALOG_CATEGORIES_STALE_MS,
    })
  }

  if (bootstrap?.searchKeyParams && bootstrap?.searchResult) {
    const { hasDates, hasBounds, hasExtra } = bootstrap.searchKeyParams._flags || {}
    const isSimpleSearch = !hasDates && !hasBounds && !hasExtra

    await qc.prefetchQuery({
      queryKey: queryKeys.catalog.search({
        ...bootstrap.searchKeyParams,
        displayCurrency: String(bootstrap.displayCurrency || 'THB').toUpperCase(),
      }),
      queryFn: () => Promise.resolve(bootstrap.searchResult),
      staleTime: isSimpleSearch ? CATALOG_SEARCH_SIMPLE_STALE_MS : 0,
    })
  }

  return dehydrate(qc)
}
