'use client'

import { useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { fetchListingDetail } from '@/lib/catalog/fetch-listing-detail'
import { fetchPublicListingCalendar } from '@/lib/api/partner-calendar-client'
import { warmupListingHeroThumb } from '@/lib/media/hero-image-warmup'
import { getNetworkQualitySnapshot } from '@/lib/media/network-quality'

const HOVER_PREFETCH_DEBOUNCE_MS = 120
/** Finger-down window before tap — warm JSON while user holds (~150ms to click). */
const TOUCH_PREFETCH_DEBOUNCE_MS = 50
const LISTING_DETAIL_STALE_MS = 5 * 60 * 1000

function resolvePrefetchDebounceMs(options) {
  return options?.intent === 'touch' ? TOUCH_PREFETCH_DEBOUNCE_MS : HOVER_PREFETCH_DEBOUNCE_MS
}

/**
 * Stage 128.2 + 171.21–22 — catalog → PDP prefetch + hero thumb warmup on touch.
 */
export function useListingDetailPrefetch() {
  const queryClient = useQueryClient()
  const timersRef = useRef(new Map())

  const prefetchListingDetail = useCallback(
    (listingId, options = {}) => {
      const id = String(listingId || '').trim()
      if (!id) return

      if (options.intent === 'touch' && options.listing) {
        warmupListingHeroThumb(options.listing)
      }

      const queryKey = queryKeys.listing.detail(id)
      if (queryClient.getQueryData(queryKey)) return

      const pending = timersRef.current.get(id)
      if (pending) clearTimeout(pending)

      const debounceMs = resolvePrefetchDebounceMs(options)
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

          const constrained = getNetworkQualitySnapshot().constrained
          const calendarDays = constrained ? 120 : 180
          const calendarKey = queryKeys.listing.calendar(id, { guests: 1, days: calendarDays })
          if (!queryClient.getQueryData(calendarKey)) {
            void queryClient.prefetchQuery({
              queryKey: calendarKey,
              queryFn: async () => {
                const { ok, calendar, error } = await fetchPublicListingCalendar(id, {
                  days: calendarDays,
                  guests: 1,
                })
                if (!ok) throw new Error(error || 'Failed to load calendar')
                return calendar
              },
              staleTime: LISTING_DETAIL_STALE_MS,
            })
          }
        }, debounceMs),
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
