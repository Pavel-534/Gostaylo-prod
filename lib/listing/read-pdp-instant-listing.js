/**
 * Read a listing DTO already in TanStack cache for the instant PDP chrome.
 * Prefers `queryKeys.listing.detail`; falls back to catalog / home / For You rows.
 */

import { queryKeys } from '@/lib/query-keys'

function listingsFromQueryData(data) {
  if (!data || typeof data !== 'object') return []
  if (Array.isArray(data.listings)) return data.listings
  if (Array.isArray(data.data?.listings)) return data.data.listings
  return []
}

/**
 * @param {import('@tanstack/react-query').QueryClient | null | undefined} queryClient
 * @param {string | null | undefined} listingId
 * @returns {object | null}
 */
export function readPdpInstantListing(queryClient, listingId) {
  const id = String(listingId || '').trim()
  if (!id || !queryClient) return null

  const detail = queryClient.getQueryData(queryKeys.listing.detail(id))
  if (detail && typeof detail === 'object' && !detail.moderationPending) return detail

  const buckets = [
    ...queryClient.getQueriesData({ queryKey: [...queryKeys.catalog.all, 'search'] }),
    ...queryClient.getQueriesData({ queryKey: [...queryKeys.home.all, 'featured'] }),
    ...queryClient.getQueriesData({ queryKey: [...queryKeys.recommendations.all, 'for-you'] }),
  ]

  for (const [, data] of buckets) {
    const hit = listingsFromQueryData(data).find((row) => String(row?.id || '').trim() === id)
    if (hit) return hit
  }

  return null
}
