/**
 * Server prefetch helpers for PDP TanStack Query hydration.
 * Stage 171.24 (PR-2) — consumed by RSC `page.js` in PR-4.
 *
 * Key contract: `queryKeys.listing.detail(id)` + mapped DTO (same shape as
 * `fetchListingDetail` / catalog `use-listing-detail-prefetch`).
 */

import { dehydrate } from '@tanstack/react-query'
import { createServerQueryClient } from '@/lib/query-prefetch/create-server-query-client'
import { queryKeys } from '@/lib/query-keys'
import { LISTING_DETAIL_STALE_MS } from '@/lib/query-prefetch/listing-detail-query-constants'

export { LISTING_DETAIL_STALE_MS } from '@/lib/query-prefetch/listing-detail-query-constants'

/**
 * Prefetch listing detail into a server QueryClient and return dehydrated state
 * for `<HydrationBoundary state={…}>`.
 *
 * @param {string} listingId
 * @param {object | null | undefined} listingDto — output of `mapListingDetailFromApi` (bootstrap.listing)
 * @returns {Promise<import('@tanstack/react-query').DehydratedState>}
 */
export async function buildListingPdpDehydratedState(listingId, listingDto) {
  const id = String(listingId || '').trim()
  const qc = createServerQueryClient()

  if (id && listingDto) {
    await qc.prefetchQuery({
      queryKey: queryKeys.listing.detail(id),
      queryFn: () => Promise.resolve(listingDto),
      staleTime: LISTING_DETAIL_STALE_MS,
    })
  }

  return dehydrate(qc)
}
