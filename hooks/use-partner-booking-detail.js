'use client'

import { useQuery } from '@tanstack/react-query'
import { partnerBookingsKeys } from '@/lib/hooks/use-partner-bookings'
import { fetchPartnerBookingDetailApi } from '@/lib/partner/partner-booking-detail'

/**
 * Lazy-load partner booking for finance ledger → booking drawer (Stage 186.2).
 */
export function usePartnerBookingDetail(bookingId, { enabled = true } = {}) {
  const id = bookingId ? String(bookingId) : null

  const query = useQuery({
    queryKey: partnerBookingsKeys.detail(id),
    queryFn: () => fetchPartnerBookingDetailApi(id),
    enabled: !!id && enabled,
    staleTime: 60_000,
  })

  return {
    booking: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}
