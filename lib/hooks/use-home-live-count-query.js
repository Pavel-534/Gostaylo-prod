'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, isSameDay } from 'date-fns'
import { queryFetchJson } from '@/lib/api/query-fetch'
import { queryKeys } from '@/lib/query-keys'
import { LISTINGS_SEARCH_API_PATH } from '@/lib/search-endpoints'
import { isTransportIntervalWizardProfile } from '@/lib/config/category-wizard-profile-db'

/**
 * Live-счётчик доступных объявлений на главной (Stage 128.1).
 * @param {object} opts
 * @param {object | null} opts.dateRange
 * @param {string} opts.where
 * @param {string} opts.guests
 * @param {string} opts.selectedCategory
 * @param {string} opts.searchQuery
 * @param {string} opts.checkInTime
 * @param {string} opts.checkOutTime
 * @param {object[]} opts.categories
 * @param {string} [opts.displayCurrency]
 */
export function useHomeLiveCountQuery({
  dateRange,
  where,
  guests,
  selectedCategory,
  searchQuery,
  checkInTime,
  checkOutTime,
  categories,
  displayCurrency = 'THB',
}) {
  const enabled = Boolean(dateRange?.from && dateRange?.to)

  const keyParams = useMemo(() => {
    const cat = selectedCategory && selectedCategory !== 'all' ? selectedCategory : null
    const wpRow = categories?.find((c) => String(c.slug) === String(cat))
    const transport = isTransportIntervalWizardProfile(
      wpRow?.wizardProfile ?? wpRow?.wizard_profile,
      cat,
    )
    const qt = (searchQuery || '').trim()
    return {
      category: cat,
      where: where && where !== 'all' ? where : null,
      checkIn: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : null,
      checkOut:
        dateRange?.to && dateRange?.from && !isSameDay(dateRange.from, dateRange.to)
          ? format(dateRange.to, 'yyyy-MM-dd')
          : null,
      checkInTime: transport && dateRange?.from && dateRange?.to ? checkInTime : null,
      checkOutTime: transport && dateRange?.from && dateRange?.to ? checkOutTime : null,
      guests: guests && guests !== '1' ? guests : null,
      q: qt.length >= 2 ? qt : null,
      displayCurrency: String(displayCurrency || 'THB').toUpperCase(),
    }
  }, [
    dateRange,
    where,
    guests,
    selectedCategory,
    searchQuery,
    checkInTime,
    checkOutTime,
    categories,
    displayCurrency,
  ])

  return useQuery({
    queryKey: queryKeys.home.liveCount(keyParams),
    enabled,
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '50' })
      params.set('softAvailability', '0')
      if (keyParams.category) params.set('category', keyParams.category)
      if (keyParams.where) params.set('where', keyParams.where)
      if (keyParams.checkIn) params.set('checkIn', keyParams.checkIn)
      if (keyParams.checkOut) params.set('checkOut', keyParams.checkOut)
      if (keyParams.checkInTime) params.set('checkInTime', keyParams.checkInTime)
      if (keyParams.checkOutTime) params.set('checkOutTime', keyParams.checkOutTime)
      if (keyParams.guests) params.set('guests', keyParams.guests)
      if (keyParams.q) params.set('q', keyParams.q)

      const data = await queryFetchJson(`${LISTINGS_SEARCH_API_PATH}?${params.toString()}`)
      return Number(data?.meta?.available ?? 0)
    },
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}
