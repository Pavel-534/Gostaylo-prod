'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { getUIText } from '@/lib/translations'

/**
 * Partner confirm/decline booking in unified thread (Stage 109.3).
 */
export function useUnifiedMessagesBookingActions({
  language,
  booking,
  selectedConv,
  setBooking,
  inbox,
  reloadThread,
  isHosting,
}) {
  const bookingMutationRef = useRef(false)
  const [declineOpen, setDeclineOpen] = useState(false)
  const [declinePreset, setDeclinePreset] = useState('occupied')
  const [declineOtherDetail, setDeclineOtherDetail] = useState('')

  const handleConfirmBooking = useCallback(async () => {
    const bid = booking?.id
    if (!bid || !selectedConv?.id || bookingMutationRef.current) return
    const st = String(booking?.status || '').toUpperCase()
    if (st !== 'PENDING' && st !== 'INQUIRY') return
    bookingMutationRef.current = true
    const prevBooking = booking
    setBooking((b) => (b ? { ...b, status: 'CONFIRMED' } : b))
    try {
      const res = await fetch(`/api/v2/partner/bookings/${encodeURIComponent(bid)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CONFIRMED' }),
      })
      const json = await res.json()
      if (json.status !== 'success') {
        setBooking(prevBooking)
        toast.error(json.error || getUIText('chatPartner_toastBookingConfirmError', language))
        return
      }
      inbox.refresh()
      reloadThread()
      toast.success(json.message || getUIText('chatPartner_toastBookingConfirmed', language))
    } catch {
      setBooking(prevBooking)
      toast.error(getUIText('listingDetail_networkError', language))
    } finally {
      bookingMutationRef.current = false
    }
  }, [booking, selectedConv?.id, setBooking, inbox, reloadThread, language])

  const handleDeclineBooking = useCallback(() => {
    setDeclinePreset('occupied')
    setDeclineOtherDetail('')
    setDeclineOpen(true)
  }, [])

  const confirmDecline = useCallback(async () => {
    const bid = booking?.id
    if (!bid || !selectedConv?.id || bookingMutationRef.current) return
    const st = String(booking?.status || '').toUpperCase()
    if (st !== 'PENDING' && st !== 'INQUIRY') return
    if (declinePreset === 'other' && !declineOtherDetail.trim()) {
      toast.error(getUIText('messengerThread_declineOtherRequired', language))
      return
    }
    bookingMutationRef.current = true
    const prevBooking = booking
    setBooking((b) => (b ? { ...b, status: 'CANCELLED' } : b))
    setDeclineOpen(false)
    try {
      const res = await fetch(`/api/v2/partner/bookings/${encodeURIComponent(bid)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'CANCELLED',
          declineReasonKey: declinePreset,
          declineReasonDetail: declinePreset === 'other' ? declineOtherDetail.trim() : '',
        }),
      })
      const json = await res.json()
      if (json.status !== 'success') {
        setBooking(prevBooking)
        setDeclineOpen(true)
        toast.error(json.error || getUIText('chatPartner_toastBookingDeclineError', language))
        return
      }
      inbox.refresh()
      reloadThread()
      toast.success(json.message || getUIText('chatPartner_toastBookingDeclined', language))
    } catch {
      setBooking(prevBooking)
      setDeclineOpen(true)
      toast.error(getUIText('listingDetail_networkError', language))
    } finally {
      bookingMutationRef.current = false
    }
  }, [
    booking,
    selectedConv?.id,
    declinePreset,
    declineOtherDetail,
    setBooking,
    inbox,
    reloadThread,
    language,
  ])

  const partnerInquiryActionsForMilestone = useMemo(() => {
    if (!isHosting || !booking?.id) return null
    const st = String(booking.status || '').toUpperCase()
    if (st !== 'PENDING' && st !== 'INQUIRY') return null
    return {
      onConfirm: handleConfirmBooking,
      onDecline: handleDeclineBooking,
      loading: false,
    }
  }, [isHosting, booking?.id, booking?.status, handleConfirmBooking, handleDeclineBooking])

  return {
    declineOpen,
    setDeclineOpen,
    declinePreset,
    setDeclinePreset,
    declineOtherDetail,
    setDeclineOtherDetail,
    handleConfirmBooking,
    handleDeclineBooking,
    confirmDecline,
    partnerInquiryActionsForMilestone,
  }
}
