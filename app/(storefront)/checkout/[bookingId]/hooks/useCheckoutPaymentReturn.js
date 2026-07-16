'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { getUIText } from '@/lib/translations'
import {
  isCheckoutIntentPaymentFailed,
  isCheckoutIntentPaymentPaid,
} from './checkout-payment-intent-status.js'

const POLL_MS = 2500
const FAST_POLL_MS = 1000
const MAX_POLLS = 12

/**
 * Stage 130.3 / 138.2 — return from YooKassa redirect (?payment=return&intent=pi-*).
 */
export function useCheckoutPaymentReturn({
  bookingId,
  invoiceIdParam,
  language,
  loadPaymentStatus,
  loadPaymentIntent,
  setPaymentSuccess,
  setPaymentFailed,
  setPaymentReturnVerifying,
}) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const handledRef = useRef(false)

  useEffect(() => {
    if (handledRef.current) return
    if (searchParams.get('payment') !== 'return') return

    handledRef.current = true
    setPaymentReturnVerifying(true)
    setPaymentFailed(false)

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

    const finishSuccess = () => {
      if (cancelled) return
      setPaymentReturnVerifying(false)
      setPaymentSuccess(true)
      toast.success(getUIText('checkout_toast_paymentOk', language))
      stripReturnQuery()
    }

    const finishFailed = () => {
      if (cancelled) return
      setPaymentReturnVerifying(false)
      setPaymentFailed(true)
      stripReturnQuery()
    }

    const resolveIntentStatus = async (resolvedInvoice) => {
      try {
        const intentUrl = new URL(
          `/api/v2/bookings/${encodeURIComponent(bookingId)}/payment-intent`,
          window.location.origin,
        )
        const resolvedInvoiceId = resolvedInvoice?.id || invoiceIdParam
        if (resolvedInvoiceId) intentUrl.searchParams.set('invoiceId', resolvedInvoiceId)
        const intentRes = await fetch(intentUrl.toString(), {
          credentials: 'include',
          cache: 'no-store',
        })
        const intentJson = await intentRes.json()
        return String(intentJson?.data?.status || '').toUpperCase()
      } catch {
        return ''
      }
    }

    const poll = async () => {
      if (cancelled) return
      polls += 1
      const result = await loadPaymentStatus()
      if (result?.booking) {
        const st = String(result.booking.status || '').toUpperCase()
        if (st === 'PAID_ESCROW' || st === 'PAID' || st === 'COMPLETED') {
          finishSuccess()
          return
        }
      }

      if (loadPaymentIntent) {
        await loadPaymentIntent(result?.resolvedInvoice)
      }

      const intentStatus = await resolveIntentStatus(result?.resolvedInvoice)
      if (isCheckoutIntentPaymentPaid(intentStatus)) {
        finishSuccess()
        return
      }
      if (isCheckoutIntentPaymentFailed(intentStatus)) {
        finishFailed()
        return
      }

      if (polls >= MAX_POLLS) {
        finishFailed()
        return
      }
      const delay = polls === 1 ? FAST_POLL_MS : POLL_MS
      setTimeout(poll, delay)
    }

    void poll()

    return () => {
      cancelled = true
      setPaymentReturnVerifying(false)
    }
  }, [
    bookingId,
    invoiceIdParam,
    language,
    loadPaymentIntent,
    loadPaymentStatus,
    router,
    searchParams,
    setPaymentFailed,
    setPaymentReturnVerifying,
    setPaymentSuccess,
  ])
}
