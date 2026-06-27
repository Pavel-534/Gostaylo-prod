'use client'

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { format } from 'date-fns'
import { queryKeys } from '@/lib/query-keys'

const AVAILABILITY_STALE_MS = 60 * 1000

/**
 * Spot availability for selected range — React Query (Stage 171.23).
 */
export function useListingAvailabilityQuery({
  listingId,
  dateRange,
  guests,
  startDateTime = null,
  endDateTime = null,
  enabled = true,
}) {
  const id = String(listingId || '').trim()
  const from = dateRange?.from
  const to = dateRange?.to
  const guestsNum = Math.max(1, Number.parseInt(String(guests), 10) || 1)

  const start = from ? format(from, 'yyyy-MM-dd') : null
  const end = to ? format(to, 'yyyy-MM-dd') : null

  return useQuery({
    queryKey: queryKeys.listing.availability(id, {
      start,
      end,
      guests: guestsNum,
      startDateTime,
      endDateTime,
    }),
    queryFn: async ({ signal }) => {
      const qs = new URLSearchParams({
        startDate: start,
        endDate: end,
        guests: String(guestsNum),
      })
      if (startDateTime && endDateTime) {
        qs.set('startDateTime', startDateTime)
        qs.set('endDateTime', endDateTime)
      }
      const res = await fetch(
        `/api/v2/listings/${encodeURIComponent(id)}/availability?${qs.toString()}`,
        { signal, credentials: 'omit' },
      )
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Availability check failed')
      return data
    },
    enabled: enabled && !!id && !!start && !!end,
    staleTime: AVAILABILITY_STALE_MS,
    placeholderData: keepPreviousData,
  })
}
