'use client'

import { useMemo } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { fetchPublicListingCalendar } from '@/lib/api/partner-calendar-client'
import { getPublicCalendarDaysAhead } from '@/lib/media/network-quality'

const CALENDAR_STALE_MS = 3 * 60 * 1000
const CALENDAR_GC_MS = 10 * 60 * 1000

/**
 * Public listing calendar grid — React Query SSOT (Stage 171.23).
 * Blocked / transition days render from cache without full-page churn.
 */
export function useListingPublicCalendarQuery(listingId, { guests = 1, enabled = true } = {}) {
  const id = String(listingId || '').trim()
  const guestsNum = Math.max(1, Number.parseInt(String(guests), 10) || 1)
  const calendarDays = getPublicCalendarDaysAhead()

  const query = useQuery({
    queryKey: queryKeys.listing.calendar(id, { guests: guestsNum, days: calendarDays }),
    queryFn: async ({ signal }) => {
      const { ok, calendar, error } = await fetchPublicListingCalendar(id, {
        days: calendarDays,
        guests: guestsNum,
        signal,
      })
      if (!ok) throw new Error(error || 'Failed to load calendar')
      return calendar
    },
    enabled: enabled && !!id,
    staleTime: CALENDAR_STALE_MS,
    gcTime: CALENDAR_GC_MS,
    placeholderData: keepPreviousData,
  })

  const calendarData = useMemo(() => {
    const map = new Map()
    for (const day of query.data || []) {
      if (day?.date) map.set(day.date, day)
    }
    return map
  }, [query.data])

  return {
    calendarData,
    isLoading: query.isLoading && calendarData.size === 0,
    isRefreshing: query.isFetching && calendarData.size > 0,
    error: query.error,
  }
}
