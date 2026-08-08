'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useUpdateBookingStatus, partnerBookingsKeys } from '@/lib/hooks/use-partner-bookings'
import { partnerStatsKeys } from '@/lib/hooks/use-partner-stats'
import { partnerCalendarKeys } from '@/lib/hooks/use-partner-calendar'
import { WALLET_ME_QUERY_KEY } from '@/lib/hooks/use-wallet-me'
import { partnerDashboardMoneyKeys } from '@/hooks/partner/use-partner-dashboard-money'
import { useHaptic } from '@/hooks/use-haptic'
import { getUIText } from '@/lib/translations'

/**
 * Stage 110.8 — approve/decline pending bookings на дашборде партнёра.
 * Stage 139 — локализованные тосты (`language`).
 * Stage 200.67 — haptic on approve/decline.
 */
export function usePartnerDashboardBookingActions(partnerId, language = 'ru') {
  const queryClient = useQueryClient()
  const updateStatusMutation = useUpdateBookingStatus()
  const haptic = useHaptic()

  const invalidatePartnerQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: partnerStatsKeys.all })
    queryClient.invalidateQueries({ queryKey: partnerCalendarKeys.all })
    queryClient.invalidateQueries({ queryKey: partnerBookingsKeys.all })
    queryClient.invalidateQueries({ queryKey: WALLET_ME_QUERY_KEY })
    queryClient.invalidateQueries({ queryKey: partnerDashboardMoneyKeys.all })
  }, [queryClient])

  const handleApprove = useCallback(
    async (bookingId) => {
      haptic.light()
      try {
        await updateStatusMutation.mutateAsync({
          bookingId,
          status: 'CONFIRMED',
          partnerId,
        })
        invalidatePartnerQueries()
        haptic.success()
        toast.success(getUIText('partnerDashboard_approveSuccess', language))
      } catch {
        haptic.error()
        toast.error(getUIText('partnerDashboard_approveError', language))
      }
    },
    [updateStatusMutation, partnerId, invalidatePartnerQueries, language, haptic],
  )

  const handleDecline = useCallback(
    async (bookingId, reason) => {
      haptic.light()
      try {
        await updateStatusMutation.mutateAsync({
          bookingId,
          status: 'CANCELLED',
          reason: reason?.trim() || getUIText('partnerDashboard_declineReason', language),
          partnerId,
        })
        invalidatePartnerQueries()
        haptic.success()
        toast.success(getUIText('partnerDashboard_declineSuccess', language))
      } catch {
        haptic.error()
        toast.error(getUIText('partnerDashboard_declineError', language))
        throw new Error('decline_failed')
      }
    },
    [updateStatusMutation, partnerId, invalidatePartnerQueries, language, haptic],
  )

  return {
    handleApprove,
    handleDecline,
    updateStatusMutation,
    isUpdatingBooking: updateStatusMutation.isPending,
  }
}
