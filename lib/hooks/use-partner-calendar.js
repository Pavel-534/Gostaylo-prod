/**
 * usePartnerCalendar - TanStack Query hook for partner calendar
 * 
 * Features:
 * - Fetch calendar data for all partner listings
 * - Mutations for blocks and manual bookings
 * - Optimistic updates and cache invalidation
 */

'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, addDays } from 'date-fns'

// Query key factory
export const partnerCalendarKeys = {
  all: ['partner-calendar'],
  data: (partnerId, dateRange) => [...partnerCalendarKeys.all, 'data', partnerId, dateRange],
}

/**
 * Fetch calendar data from API v2
 */
async function fetchCalendarData({ partnerId, startDate, endDate }) {
  const params = new URLSearchParams()
  if (partnerId) params.set('partnerId', partnerId)
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)
  
  const res = await fetch(`/api/v2/partner/calendar?${params.toString()}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  })
  
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to fetch calendar')
  }
  
  return res.json()
}

/**
 * Hook to fetch partner calendar
 */
export function usePartnerCalendar(partnerId, options = {}) {
  const today = new Date()
  const { 
    startDate = format(today, 'yyyy-MM-dd'),
    endDate = format(addDays(today, 30), 'yyyy-MM-dd'),
    enabled = true 
  } = options
  
  return useQuery({
    queryKey: partnerCalendarKeys.data(partnerId, { startDate, endDate }),
    queryFn: () => fetchCalendarData({ partnerId, startDate, endDate }),
    enabled: !!partnerId && enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes for calendar
    select: (response) => response.data
  })
}

/**
 * Hook to create availability block
 */
export function useCreateBlock() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ listingId, startDate, endDate, reason, type, partnerId }) => {
      const res = await fetch(`/api/v2/partner/calendar/block?partnerId=${partnerId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, startDate, endDate, reason, type })
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create block')
      }
      
      return res.json()
    },
    
    onSuccess: () => {
      toast.success('Даты заблокированы')
    },
    
    onError: (err) => {
      toast.error(err.message || 'Ошибка при блокировке дат')
    },
    
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: partnerCalendarKeys.all })
    }
  })
}

/**
 * Hook to delete availability block
 */
export function useDeleteBlock() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ blockId, partnerId }) => {
      const res = await fetch(
        `/api/v2/partner/calendar/block?blockId=${blockId}&partnerId=${partnerId}`,
        {
          method: 'DELETE',
          credentials: 'include'
        }
      )
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete block')
      }
      
      return res.json()
    },
    
    onSuccess: () => {
      toast.success('Блокировка снята')
    },
    
    onError: (err) => {
      toast.error(err.message || 'Ошибка при снятии блокировки')
    },
    
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: partnerCalendarKeys.all })
    }
  })
}

/**
 * Hook to create manual booking
 */
export function useCreateManualBooking() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ listingId, checkIn, checkOut, guestName, guestPhone, guestEmail, priceThb, notes, partnerId }) => {
      const res = await fetch(`/api/v2/partner/calendar/manual-booking?partnerId=${partnerId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          listingId, 
          checkIn, 
          checkOut, 
          guestName, 
          guestPhone, 
          guestEmail, 
          priceThb,
          notes 
        })
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create booking')
      }
      
      return res.json()
    },
    
    onSuccess: () => {
      toast.success('Бронирование создано')
    },
    
    onError: (err) => {
      toast.error(err.message || 'Ошибка при создании бронирования')
    },
    
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: partnerCalendarKeys.all })
    }
  })
}

export default usePartnerCalendar
