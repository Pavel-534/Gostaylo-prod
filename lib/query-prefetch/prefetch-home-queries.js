/**
 * Server prefetch helpers for home TanStack Query hydration.
 * Stage 171.27 — categories + default featured grid.
 */

import { dehydrate } from '@tanstack/react-query'
import { createServerQueryClient } from '@/lib/query-prefetch/create-server-query-client'
import { queryKeys } from '@/lib/query-keys'
import { CATALOG_CATEGORIES_STALE_MS } from '@/lib/query-prefetch/catalog-query-constants'
import { HOME_FEATURED_STALE_MS } from '@/lib/query-prefetch/home-query-constants'

export { HOME_FEATURED_STALE_MS } from '@/lib/query-prefetch/home-query-constants'

/**
 * @param {import('@/lib/listing/get-cached-home-bootstrap.js').HomeBootstrapResult} bootstrap
 * @returns {Promise<import('@tanstack/react-query').DehydratedState>}
 */
export async function buildHomeDehydratedState(bootstrap) {
  const qc = createServerQueryClient()

  if (bootstrap?.categories?.length) {
    await qc.prefetchQuery({
      queryKey: queryKeys.public.categories(),
      queryFn: () => Promise.resolve(bootstrap.categories),
      staleTime: CATALOG_CATEGORIES_STALE_MS,
    })
  }

  if (bootstrap?.featuredKeyParams && bootstrap?.featuredResult) {
    await qc.prefetchQuery({
      queryKey: queryKeys.home.featured(bootstrap.featuredKeyParams),
      queryFn: () => Promise.resolve(bootstrap.featuredResult),
      staleTime: HOME_FEATURED_STALE_MS,
    })
  }

  return dehydrate(qc)
}
