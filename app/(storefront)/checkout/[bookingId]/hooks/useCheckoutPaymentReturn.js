'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { getUIText } from '@/lib/translations'
import { resolveGuestPayReturnFailureCopy } from '@/lib/checkout/guest-pay-error-messages.js'
import {
  isCheckoutBookingPaymentCapturedPendingEscrow,
  isCheckoutBookingPaymentSettled,
  isCheckoutIntentPaymentFailed,
  isCheckoutIntentPaymentPaid,
} from './checkout-payment-intent-status.js'

const POLL_MS = 2500
const FAST_POLL_MS = 1000
/** ~2 minutes — webhook capture can lag after PSP redirect (Stage 200.76). */
const MAX_POLLS = 48

/**
 * Stage 130.3 / 138.2 / 198 / 200.76 — return from acquirer (?payment=return&intent=pi-*).
 * Strict Mode safe: do not latch "handled" until success/fail (cleanup must allow remount poll).
 */
export function useCheckoutPaymentReturn({
  bookingId,
  invoiceIdParam,
  language,
  loadPaymentStatus,
  loadPaymentIntent,
  setPaymentSuccess,
  setPaymentFailed,
  setPaymentFailReason,
  setPaymentReturnVerifying,
}) {
  const searchParams = useSearchParams()
  const router = useRouter()
  /** Only skip re-entry after a terminal finish for this return session. */
  const finishedSessionRef = useRef(null)

  useEffect(() => {
    if (searchParams.get('payment') !== 'return') return

    const intentHint = String(searchParams.get('intent') || '').trim()
    const sessionKey = `${bookingId}|${intentHint}|return`
    if (finishedSessionRef.current === sessionKey) return

    setPaymentReturnVerifying(true)
    setPaymentFailed(false)
    if (typeof setPaymentFailReason === 'function') setPaymentFailReason(null)

    let polls = 0
    let cancelled = false
    let timeoutId = null

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
      finishedSessionRef.current = sessionKey
      setPaymentReturnVerifying(false)
      setPaymentSuccess(true)
      toast.success(getUIText('checkout_toast_paymentOk', language))
      stripReturnQuery()
    }

    const finishFailed = (intentStatus, { timedOut = false } = {}) => {
      if (cancelled) return
      finishedSessionRef.current = sessionKey
      const copy = resolveGuestPayReturnFailureCopy(intentStatus, { timedOut })
      if (typeof setPaymentFailReason === 'function') setPaymentFailReason(copy.reason)
      setPaymentReturnVerifying(false)
      setPaymentFailed(true)
      toast.error(getUIText(copy.bodyKey, language))
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
      let bookingSt = ''
      if (result?.booking) {
        bookingSt = String(result.booking.status || '').toUpperCase()
        if (isCheckoutBookingPaymentSettled(bookingSt)) {
          finishSuccess()
          return
        }
      }

      if (loadPaymentIntent) {
        await loadPaymentIntent(result?.resolvedInvoice)
      }

      const intentStatus = await resolveIntentStatus(result?.resolvedInvoice)
      // Stage 202.12 — intent PAID alone keeps polling until escrow (or timeout with capture).
      if (isCheckoutIntentPaymentFailed(intentStatus)) {
        finishFailed(intentStatus)
        return
      }

      if (polls >= MAX_POLLS) {
        if (
          isCheckoutIntentPaymentPaid(intentStatus) ||
          isCheckoutBookingPaymentCapturedPendingEscrow(bookingSt)
        ) {
          // Gateway confirmed; escrow heal cron may lag — do not mark as payment failure.
          finishSuccess()
          return
        }
        finishFailed(intentStatus, { timedOut: true })
        return
      }
      const delay = polls === 1 ? FAST_POLL_MS : POLL_MS
      timeoutId = setTimeout(poll, delay)
    }

    void poll()

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
      // Remount (Strict Mode): allow a fresh poll; only terminal finish latches session.
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
    setPaymentFailReason,
    setPaymentFailed,
    setPaymentReturnVerifying,
    setPaymentSuccess,
  ])
}
