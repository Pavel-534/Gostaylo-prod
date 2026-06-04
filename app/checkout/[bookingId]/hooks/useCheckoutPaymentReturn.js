'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { getUIText } from '@/lib/translations'

const POLL_MS = 2500
const MAX_POLLS = 12

/**
 * Stage 130.3 — return from YooKassa redirect (?payment=return&intent=pi-*).
 */
export function useCheckoutPaymentReturn({
  bookingId,
  language,
  loadPaymentStatus,
  loadPaymentIntent,
  setPaymentSuccess,
}) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const handledRef = useRef(false)

  useEffect(() => {
    if (handledRef.current) return
    if (searchParams.get('payment') !== 'return') return

    const intentParam = searchParams.get('intent')
    handledRef.current = true

    toast.info(getUIText('checkout_toast_paymentReturnPending', language))

    let polls = 0
    let cancelled = false

    const stripReturnQuery = () => {
      try {
        const url = new URL(window.location.href)
        url.searchParams.delete('payment')
        url.searchParams.delete('intent')
        router.replace(url.pathname + url.search, { scroll: false })
      } catch {
        /* non-critical */
      }
    }

    const poll = async () => {
      if (cancelled) return
      polls += 1
      const result = await loadPaymentStatus()
      if (result?.booking) {
        const st = String(result.booking.status || '').toUpperCase()
        if (st === 'PAID_ESCROW' || st === 'PAID' || st === 'COMPLETED') {
          setPaymentSuccess(true)
          toast.success(getUIText('checkout_toast_paymentOk', language))
          stripReturnQuery()
          return
        }
      }

      if (loadPaymentIntent) {
        await loadPaymentIntent(result?.resolvedInvoice)
      }

      if (intentParam) {
        try {
          const intentRes = await fetch(
            `/api/v2/bookings/${encodeURIComponent(bookingId)}/payment-intent`,
            { credentials: 'include', cache: 'no-store' },
          )
          const intentJson = await intentRes.json()
          const intentStatus = String(intentJson?.data?.status || '').toUpperCase()
          if (intentStatus === 'PAID') {
            setPaymentSuccess(true)
            toast.success(getUIText('checkout_toast_paymentOk', language))
            stripReturnQuery()
            return
          }
        } catch {
          /* retry on next poll */
        }
      }

      if (polls >= MAX_POLLS) {
        toast.message(getUIText('checkout_toast_paymentReturnStillPending', language))
        stripReturnQuery()
        return
      }
      setTimeout(poll, POLL_MS)
    }

    void poll()

    return () => {
      cancelled = true
    }
  }, [
    bookingId,
    language,
    loadPaymentIntent,
    loadPaymentStatus,
    router,
    searchParams,
    setPaymentSuccess,
  ])
}
