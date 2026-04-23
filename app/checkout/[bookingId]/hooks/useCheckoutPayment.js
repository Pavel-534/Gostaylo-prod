import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { getUIText, detectLanguage, DEFAULT_UI_LANGUAGE } from '@/lib/translations'
import { GOSTAYLO_WALLET, DEFAULT_ALLOWED_METHODS } from './checkout-constants.js'

/**
 * @param {object} opts
 * @param {string} opts.bookingId
 * @param {string | null} opts.invoiceIdParam
 * @param {{ id?: string } | null} opts.user
 * @param {boolean} opts.authLoading
 */
export function useCheckoutPayment({ bookingId, invoiceIdParam, user, authLoading }) {
  const [language, setLanguage] = useState(DEFAULT_UI_LANGUAGE)
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [booking, setBooking] = useState(null)
  const [listing, setListing] = useState(null)
  const [payment, setPayment] = useState(null)
  const [invoice, setInvoice] = useState(null)
  const [paymentIntent, setPaymentIntent] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('CARD')
  const [allowedMethods, setAllowedMethods] = useState(DEFAULT_ALLOWED_METHODS)
  const [processing, setProcessing] = useState(false)
  const [cryptoModalOpen, setCryptoModalOpen] = useState(false)
  const [txId, setTxId] = useState('')
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [verificationStep, setVerificationStep] = useState(0)
  const [confirmations, setConfirmations] = useState(0)
  const [verifying, setVerifying] = useState(false)
  const [txidSubmitted, setTxidSubmitted] = useState(false)
  const [liveVerification, setLiveVerification] = useState(null)
  const [chatConversationId, setChatConversationId] = useState(null)

  useEffect(() => {
    const lang = detectLanguage()
    setLanguage(lang)
    const h = (e) => {
      if (e?.detail) setLanguage(e.detail)
    }
    window.addEventListener('language-change', h)
    window.addEventListener('languageChange', h)
    return () => {
      window.removeEventListener('language-change', h)
      window.removeEventListener('languageChange', h)
    }
  }, [])

  const loadPaymentStatus = useCallback(async () => {
    try {
      const bookingRes = await fetch(`/api/v2/bookings/${bookingId}`, { cache: 'no-store' })
      const bookingData = await bookingRes.json()

      if (!bookingData.success || !bookingData.data) {
        console.error('[CHECKOUT] Booking not found:', bookingData.error)
        setLoading(false)
        return
      }

      const b = bookingData.data
      const l = b.listings

      setBooking({
        id: b.id,
        renter_id: b.renter_id,
        status: b.status,
        checkIn: b.check_in,
        checkOut: b.check_out,
        priceThb: parseFloat(b.price_thb),
        currency: b.currency || 'THB',
        guestName: b.guest_name,
        guestEmail: b.guest_email,
        guestPhone: b.guest_phone,
        specialRequests: b.special_requests,
        createdAt: b.created_at,
        metadata: b.metadata,
        commissionRate: parseFloat(b.commission_rate),
        commissionThb: parseFloat(b.commission_thb) || 0,
        partnerEarningsThb: parseFloat(b.partner_earnings_thb) || 0,
        roundingDiffPot: parseFloat(b.rounding_diff_pot) || 0,
        taxableMarginAmount: parseFloat(b.taxable_margin_amount) || 0,
      })

      if (l) {
        setListing({
          id: l.id,
          title: l.title,
          district: l.district,
          coverImage: l.cover_image || l.images?.[0],
          basePriceThb: parseFloat(l.base_price_thb),
        })
      }

      let resolvedInvoice = null
      if (invoiceIdParam) {
        try {
          const invRes = await fetch(`/api/v2/chat/invoice?id=${encodeURIComponent(invoiceIdParam)}`, {
            credentials: 'include',
            cache: 'no-store',
          })
          const invData = await invRes.json()
          if (invRes.ok && invData.success && Array.isArray(invData.invoices) && invData.invoices.length > 0) {
            resolvedInvoice = invData.invoices[0]
            setInvoice(resolvedInvoice)
          } else {
            setInvoice(null)
          }
        } catch {
          setInvoice(null)
        }
      } else {
        setInvoice(null)
      }

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
        const intentData = await intentRes.json()
        if (intentRes.ok && intentData?.success && intentData?.data) {
          setPaymentIntent(intentData.data)
          const allowed = Array.isArray(intentData.data.allowedMethods)
            ? intentData.data.allowedMethods
                .map((m) => String(m || '').toUpperCase())
                .filter((m) => DEFAULT_ALLOWED_METHODS.includes(m))
            : []
          setAllowedMethods(allowed.length > 0 ? allowed : DEFAULT_ALLOWED_METHODS)
        } else {
          setPaymentIntent(null)
          setAllowedMethods(DEFAULT_ALLOWED_METHODS)
        }
      } catch {
        setPaymentIntent(null)
        setAllowedMethods(DEFAULT_ALLOWED_METHODS)
      }

      if (b.status === 'PAID' || b.status === 'COMPLETED') {
        setPayment({
          id: `pay-${b.id}`,
          status: 'COMPLETED',
          method: 'CARD',
          amount: b.price_thb,
        })
        setPaymentSuccess(true)
      }

      if (b.conversation_id) {
        setChatConversationId(b.conversation_id)
      } else {
        try {
          const convRes = await fetch(`/api/v2/chat/conversations?id=${encodeURIComponent(b.id)}&enrich=0`, {
            credentials: 'include',
          })
          const convJson = await convRes.json()
          const convId = convJson.data?.[0]?.id
          if (convId) setChatConversationId(convId)
          else {
            const convRes2 = await fetch(`/api/v2/chat/conversations?enrich=0`, { credentials: 'include' })
            const convJson2 = await convRes2.json()
            const matched = Array.isArray(convJson2.data)
              ? convJson2.data.find((c) => String(c.bookingId) === String(b.id))
              : null
            if (matched?.id) setChatConversationId(matched.id)
          }
        } catch {
          /* non-critical */
        }
      }

      setLoading(false)
    } catch (error) {
      console.error('Failed to load payment status:', error)
      setLoading(false)
    }
  }, [bookingId, invoiceIdParam])

  useEffect(() => {
    loadPaymentStatus()
  }, [loadPaymentStatus])

  useEffect(() => {
    if (authLoading || !booking) return
    if (booking.renter_id) {
      if (!user?.id) {
        setAccessDenied(true)
        return
      }
      if (booking.renter_id !== user.id) {
        setAccessDenied(true)
      }
    }
  }, [authLoading, booking, user])

  const handleConfirmPayment = useCallback(
    async (transactionId = null, gatewayRef = null) => {
      if (paymentMethod === 'CRYPTO' && transactionId) {
        setVerifying(true)
        setVerificationStep(1)
        try {
          toast.info(getUIText('checkout_toast_txReceived', language))
          await new Promise((r) => setTimeout(r, 1000))
          setVerificationStep(2)
          for (let i = 0; i <= 19; i++) {
            setConfirmations(i)
            await new Promise((r) => setTimeout(r, 100))
          }
          const verifyRes = await fetch('/api/webhooks/crypto/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              txid: transactionId,
              bookingId,
              expectedAmount: payment?.metadata?.amount_usdt || payment?.metadata?.amount || undefined,
              targetWallet: payment?.metadata?.wallet_address || payment?.metadata?.walletAddress || undefined,
            }),
          })
          const verifyData = await verifyRes.json()
          if (!verifyData.verified) {
            toast.error(verifyData.error || getUIText('checkout_toast_txNotVerified', language))
            setVerifying(false)
            setVerificationStep(0)
            return
          }
          setVerificationStep(3)
          toast.success(getUIText('checkout_toast_chainOk', language))
          await new Promise((r) => setTimeout(r, 500))
          const res = await fetch(`/api/v2/bookings/${bookingId}/payment/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              txId: transactionId,
              gatewayRef: verifyData.data?.blockNumber,
              invoiceId: invoiceIdParam || undefined,
              intentId: payment?.intentId || payment?.id || undefined,
            }),
          })
          const data = await res.json()
          if (data.success) {
            setPaymentSuccess(true)
            setCryptoModalOpen(false)
            await loadPaymentStatus()
          } else {
            toast.error(data.error || getUIText('checkout_toast_paymentConfirmFail', language))
          }
        } catch (error) {
          console.error('Failed to verify crypto payment:', error)
          toast.error(getUIText('checkout_toast_verifyPaymentFail', language))
          setVerificationStep(0)
        } finally {
          setVerifying(false)
        }
        return
      }
      try {
        const res = await fetch(`/api/v2/bookings/${bookingId}/payment/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            txId: transactionId || txId,
            gatewayRef,
            invoiceId: invoiceIdParam || undefined,
            intentId: payment?.intentId || payment?.id || undefined,
          }),
        })
        const data = await res.json()
        if (data.success) {
          toast.success(getUIText('checkout_toast_paymentOk', language))
          setPaymentSuccess(true)
          setCryptoModalOpen(false)
        } else {
          toast.error(data.error || getUIText('checkout_toast_paymentConfirmFail', language))
        }
      } catch (error) {
        console.error('Failed to confirm payment:', error)
        toast.error(getUIText('checkout_toast_paymentConfirmFail', language))
      }
    },
    [paymentMethod, bookingId, language, payment, txId, invoiceIdParam, loadPaymentStatus],
  )

  const handleInitiatePayment = useCallback(async () => {
    setProcessing(true)
    try {
      const res = await fetch(`/api/v2/bookings/${bookingId}/payment/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: paymentMethod,
          invoiceId: invoiceIdParam || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        const pay = data.data
        setPayment(pay)
        if (paymentMethod === 'CRYPTO') {
          setCryptoModalOpen(true)
        } else {
          const checkoutUrl = pay?.checkoutUrl
          if (typeof checkoutUrl === 'string' && checkoutUrl.length > 0) {
            window.location.assign(checkoutUrl)
            return
          }
          // TODO(Production Flag): real acquiring (Mandarin CARD_INTL, YooKassa MIR_RU) returns `checkoutUrl` from
          // `POST .../payment/initiate` via `lib/services/payment-adapters` + `PaymentIntentService.initiate`. Mock
          // confirm is for local/staging, or set NEXT_PUBLIC_CHECKOUT_MOCK_ACQUIRING=1. Set NEXT_PUBLIC_CHECKOUT_MOCK_ACQUIRING=0 in prod to forbid auto-MOCK.
          const mockAllowed =
            process.env.NODE_ENV !== 'production' ||
            process.env.NEXT_PUBLIC_CHECKOUT_MOCK_ACQUIRING === '1'
          if (!mockAllowed) {
            toast.error(getUIText('checkout_toast_acquiringNotConfigured', language))
            return
          }
          toast.success(getUIText('checkout_toast_mockRedirect', language))
          setTimeout(() => {
            void handleConfirmPayment(null, `MOCK-${Date.now()}`)
          }, 2000)
        }
      } else {
        toast.error(data.error || getUIText('checkout_toast_paymentInitFail', language))
      }
    } catch (error) {
      console.error('Failed to initiate payment:', error)
      toast.error(getUIText('checkout_toast_paymentInitFail', language))
    } finally {
      setProcessing(false)
    }
  }, [bookingId, invoiceIdParam, paymentMethod, language, handleConfirmPayment])

  const copyToClipboard = useCallback(
    (text) => {
      navigator.clipboard.writeText(text)
      toast.success(getUIText('checkout_copySuccess', language))
    },
    [language],
  )

  const handleVerifyTxid = useCallback(async () => {
    if (!txId.trim() || txId.length < 60) {
      toast.error(getUIText('checkout_toast_txidShort', language))
      return
    }
    setVerifying(true)
    setLiveVerification(null)
    try {
      const res = await fetch('/api/v2/payments/verify-tron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txid: txId, bookingId }),
      })
      const data = await res.json()
      setLiveVerification(data)
      if (data.success) {
        toast.success(getUIText('checkout_toast_txFound', language))
        if (data.paymentSettled?.success === true) {
          toast.success(language === 'ru' ? 'Платёж и эскроу обновлены' : 'Payment and escrow updated')
          setPaymentSuccess(true)
          setCryptoModalOpen(false)
          void loadPaymentStatus()
        } else if (data.paymentSettled && data.paymentSettled.success === false && data.paymentSettled.error) {
          toast.error(
            language === 'ru'
              ? `Платёж не проведён: ${data.paymentSettled.error}`
              : `Payment not settled: ${data.paymentSettled.error}`,
          )
        }
      } else if (data.status === 'PENDING') {
        toast.info(getUIText('checkout_toast_txPending', language))
      } else if (data.status === 'NOT_FOUND') {
        toast.warning(getUIText('checkout_toast_txNotFound', language))
      } else {
        toast.error(data.error || getUIText('checkout_toast_verifyError', language))
      }
    } catch (error) {
      console.error('Verification error:', error)
      toast.error(getUIText('checkout_toast_checkTxFail', language))
    } finally {
      setVerifying(false)
    }
  }, [txId, bookingId, language, loadPaymentStatus])

  const handleSubmitTxid = useCallback(async () => {
    if (!txId.trim() || txId.length < 60) {
      toast.error(getUIText('checkout_toast_txidShort', language))
      return
    }
    setVerifying(true)
    try {
      const res = await fetch('/api/v2/payments/submit-txid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          txid: txId,
          paymentMethod: 'USDT_TRC20',
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(getUIText('checkout_toast_txSubmitOk', language))
        setTxidSubmitted(true)
      } else {
        toast.error(data.error || getUIText('checkout_toast_txSubmitFail', language))
      }
    } catch (error) {
      console.error('Submit TXID error:', error)
      toast.error(getUIText('checkout_toast_txSubmitFail', language))
    } finally {
      setVerifying(false)
    }
  }, [bookingId, txId, language])

  return {
    language,
    GOSTAYLO_WALLET,
    DEFAULT_ALLOWED_METHODS,
    loading,
    accessDenied,
    booking,
    listing,
    payment,
    invoice,
    paymentIntent,
    allowedMethods,
    setAllowedMethods,
    paymentMethod,
    setPaymentMethod,
    processing,
    cryptoModalOpen,
    setCryptoModalOpen,
    txId,
    setTxId,
    paymentSuccess,
    transactionVerificationStep: verificationStep,
    confirmations,
    verifying,
    txidSubmitted,
    liveVerification,
    setLiveVerification,
    chatConversationId,
    loadPaymentStatus,
    handleInitiatePayment,
    handleConfirmPayment,
    copyToClipboard,
    handleVerifyTxid,
    handleSubmitTxid,
  }
}
