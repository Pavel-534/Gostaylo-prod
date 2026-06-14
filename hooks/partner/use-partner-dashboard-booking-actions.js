'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useUpdateBookingStatus, partnerBookingsKeys } from '@/lib/hooks/use-partner-bookings'
import { partnerStatsKeys } from '@/lib/hooks/use-partner-stats'
import { partnerCalendarKeys } from '@/lib/hooks/use-partner-calendar'
import { getUIText } from '@/lib/translations'

/**
 * Stage 110.8 — approve/decline pending bookings на дашборде партнёра.
 * Stage 139 — локализованные тосты (`language`).
 */
export function usePartnerDashboardBookingActions(partnerId, language = 'ru') {
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
        toast.success(getUIText('partnerDashboard_approveSuccess', language))
      } catch {
        toast.error(getUIText('partnerDashboard_approveError', language))
      }
    },
    [updateStatusMutation, partnerId, invalidatePartnerQueries, language],
  )

  const handleDecline = useCallback(
    async (bookingId) => {
      try {
        await updateStatusMutation.mutateAsync({
          bookingId,
          status: 'CANCELLED',
          reason: getUIText('partnerDashboard_declineReason', language),
          partnerId,
        })
        invalidatePartnerQueries()
        toast.success(getUIText('partnerDashboard_declineSuccess', language))
      } catch {
        toast.error(getUIText('partnerDashboard_declineError', language))
      }
    },
    [updateStatusMutation, partnerId, invalidatePartnerQueries, language],
  )

  return {
    handleApprove,
    handleDecline,
    updateStatusMutation,
    isUpdatingBooking: updateStatusMutation.isPending,
  }
}
