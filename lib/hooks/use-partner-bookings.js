/**
 * usePartnerBookings - TanStack Query hook for partner bookings
 * 
 * Features:
 * - Auto-refetch on window focus
 * - Optimistic updates for status changes
 * - Cache invalidation on mutations
 * - Loading and error states
 */

'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { partnerCalendarKeys } from './use-partner-calendar'
import { partnerStatsKeys } from './use-partner-stats'

// Query key factory
export const partnerBookingsKeys = {
  all: ['partner-bookings'],
  list: (partnerId, filters) => [...partnerBookingsKeys.all, 'list', partnerId, filters],
  detail: (id) => [...partnerBookingsKeys.all, 'detail', id],
}

/**
 * Fetch partner bookings from API v2
 */
async function fetchPartnerBookings({ partnerId, status }) {
  const params = new URLSearchParams()
  if (partnerId) params.set('partnerId', partnerId)
  if (status && status !== 'all') params.set('status', status)
  
  const res = await fetch(`/api/v2/partner/bookings?${params.toString()}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    }
  })
  
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to fetch bookings')
  }
  
  return res.json()
}

/**
 * Update booking status via API v2
 */
async function updateBookingStatus({ bookingId, status, reason, partnerId }) {
  const res = await fetch(`/api/v2/partner/bookings/${bookingId}?partnerId=${partnerId}`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status, reason })
  })
  
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to update booking')
  }
  
  return res.json()
}

/**
 * Hook to fetch partner bookings
 */
export function usePartnerBookings(partnerId, options = {}) {
  const { status = 'all', enabled = true } = options
  
  return useQuery({
    queryKey: partnerBookingsKeys.list(partnerId, { status }),
    queryFn: () => fetchPartnerBookings({ partnerId, status }),
    enabled: !!partnerId && enabled,
    select: (response) => ({
      bookings: response.data || [],
      total: response.meta?.total || 0,
      meta: response.meta
    })
  })
}

/**
 * Hook to update booking status with optimistic updates
 */
export function useUpdateBookingStatus() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: updateBookingStatus,
    
    // Optimistic update
    onMutate: async ({ bookingId, status, partnerId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: partnerBookingsKeys.all })
      
      // Snapshot previous value
      const previousBookings = queryClient.getQueryData(
        partnerBookingsKeys.list(partnerId, { status: 'all' })
      )
      
      // Optimistically update
      queryClient.setQueryData(
        partnerBookingsKeys.list(partnerId, { status: 'all' }),
        (old) => {
          if (!old?.data) return old
          return {
            ...old,
            data: old.data.map(b => 
              b.id === bookingId ? { ...b, status } : b
            )
          }
        }
      )
      
      return { previousBookings }
    },
    
    // Rollback on error
    onError: (err, { partnerId }, context) => {
      if (context?.previousBookings) {
        queryClient.setQueryData(
          partnerBookingsKeys.list(partnerId, { status: 'all' }),
          context.previousBookings
        )
      }
      toast.error(err.message || 'Ошибка при обновлении статуса')
    },
    
    // Refetch on success
    onSuccess: (data, { status }) => {
      const message = status === 'CONFIRMED' 
        ? 'Бронирование подтверждено' 
        : status === 'CANCELLED'
        ? 'Бронирование отклонено'
        : 'Статус обновлён'
      toast.success(message)
    },
    
    // Always refetch after mutation - REACTIVE: invalidate calendar and stats too
    onSettled: (_, __, { partnerId }) => {
      queryClient.invalidateQueries({ queryKey: partnerBookingsKeys.list(partnerId, {}) })
      queryClient.invalidateQueries({ queryKey: partnerCalendarKeys.all })
      queryClient.invalidateQueries({ queryKey: partnerStatsKeys.all })
    }
  })
}

export default usePartnerBookings
