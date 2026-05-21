'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useUpdateBookingStatus, partnerBookingsKeys } from '@/lib/hooks/use-partner-bookings'
import { partnerStatsKeys } from '@/lib/hooks/use-partner-stats'
import { partnerCalendarKeys } from '@/lib/hooks/use-partner-calendar'

/**
 * Stage 110.8 — approve/decline pending bookings на дашборде партнёра.
 */
export function usePartnerDashboardBookingActions(partnerId) {
  const queryClient = useQueryClient()
  const updateStatusMutation = useUpdateBookingStatus()

  const invalidatePartnerQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: partnerStatsKeys.all })
    queryClient.invalidateQueries({ queryKey: partnerCalendarKeys.all })
    queryClient.invalidateQueries({ queryKey: partnerBookingsKeys.all })
  }, [queryClient])

  const handleApprove = useCallback(
    async (bookingId) => {
      try {
        await updateStatusMutation.mutateAsync({
          bookingId,
          status: 'CONFIRMED',
          partnerId,
        })
        invalidatePartnerQueries()
        toast.success('Бронирование подтверждено!')
      } catch {
        toast.error('Ошибка при подтверждении')
      }
    },
    [updateStatusMutation, partnerId, invalidatePartnerQueries],
  )

  const handleDecline = useCallback(
    async (bookingId) => {
      try {
        await updateStatusMutation.mutateAsync({
          bookingId,
          status: 'CANCELLED',
          reason: 'Отклонено партнёром',
          partnerId,
        })
        invalidatePartnerQueries()
        toast.success('Бронирование отклонено')
      } catch {
        toast.error('Ошибка при отклонении')
      }
    },
    [updateStatusMutation, partnerId, invalidatePartnerQueries],
  )

  return { handleApprove, handleDecline, updateStatusMutation }
}
