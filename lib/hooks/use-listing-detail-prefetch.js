'use client'

import { useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { fetchListingDetail } from '@/lib/catalog/fetch-listing-detail'

const PREFETCH_DEBOUNCE_MS = 120
const LISTING_DETAIL_STALE_MS = 5 * 60 * 1000

/**
 * Stage 128.2 — hover prefetch карточки → PDP (`queryKeys.listing.detail`).
 */
export function useListingDetailPrefetch() {
  const queryClient = useQueryClient()
  const timersRef = useRef(new Map())

  const prefetchListingDetail = useCallback(
    (listingId) => {
      const id = String(listingId || '').trim()
      if (!id) return

      const queryKey = queryKeys.listing.detail(id)
      const existing = queryClient.getQueryData(queryKey)
      if (existing) return

      const pending = timersRef.current.get(id)
      if (pending) clearTimeout(pending)

      timersRef.current.set(
        id,
        setTimeout(() => {
          timersRef.current.delete(id)
          if (queryClient.getQueryData(queryKey)) return
          void queryClient.prefetchQuery({
            queryKey,
            queryFn: () => fetchListingDetail(id),
            staleTime: LISTING_DETAIL_STALE_MS,
          })
        }, PREFETCH_DEBOUNCE_MS),
      )
    },
    [queryClient],
  )

  const cancelListingDetailPrefetch = useCallback((listingId) => {
    const id = String(listingId || '').trim()
    if (!id) return
    const pending = timersRef.current.get(id)
    if (pending) {
      clearTimeout(pending)
      timersRef.current.delete(id)
    }
  }, [])

  return { prefetchListingDetail, cancelListingDetailPrefetch }
}
