import { useCallback } from 'react'
import { toast } from 'sonner'
import { getUIText } from '@/lib/translations'
import { DEFAULT_ALLOWED_METHODS } from './checkout-constants.js'
import { LEGAL_CONSENT_ERROR_CODE } from '@/lib/legal-consent'

function resolveCheckoutInitiateError(data, language) {
  const code = String(data?.code || '').toUpperCase()
  if (code === 'BOOKING_NOT_PAYABLE') {
    return getUIText('checkout_error_notPayable', language)
  }
  if (code === 'WALLET_ACTIVATION_REQUIRED') {
    return getUIText('checkout_toast_paymentInitFail', language)
  }
  const err = String(data?.error || '').trim()
  if (/^[A-Z][A-Z0-9_]{7,}$/.test(err)) {
    return getUIText('checkout_toast_paymentInitFail', language)
  }
  return err || getUIText('checkout_toast_paymentInitFail', language)
}

export function useCheckoutIntentFlow({
  bookingId,
  invoiceIdParam,
  language,
  paymentMethod,
  setPaymentMethod,
  payment,
  setPayment,
  allowedMethods,
  setAllowedMethods,
  processing,
  setProcessing,
  cryptoModalOpen,
  setCryptoModalOpen,
  paymentIntent,
  setPaymentIntent,
  useWalletBonuses,
  walletUseThb,
  acceptedLegalTermsForPayment,
  handleConfirmPayment,
  refreshWalletEverywhere,
}) {
  const loadPaymentIntent = useCallback(
    async (resolvedInvoice) => {
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
    },
    [bookingId, invoiceIdParam],
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
          walletUseThb: useWalletBonuses ? walletUseThb : 0,
          acceptedLegalTerms: acceptedLegalTermsForPayment,
        }),
      })
      const data = await res.json()
      if (data.code === LEGAL_CONSENT_ERROR_CODE) {
        toast.error(getUIText('checkout_legalConsentRequiredToast', language))
        return
      }
      if (data.success) {
        const pay = data.data
        setPayment(pay)
        if (Number(data?.data?.walletUseAppliedThb || 0) > 0) {
          await refreshWalletEverywhere()
        }
        if (paymentMethod === 'CRYPTO') {
          setCryptoModalOpen(true)
        } else {
          const checkoutUrl = pay?.checkoutUrl
          if (typeof checkoutUrl === 'string' && checkoutUrl.length > 0) {
            window.location.assign(checkoutUrl)
            return
          }
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
        toast.error(resolveCheckoutInitiateError(data, language))
      }
    } catch (error) {
      console.error('Failed to initiate payment:', error)
      toast.error(getUIText('checkout_toast_paymentInitFail', language))
    } finally {
      setProcessing(false)
    }
  }, [
    bookingId,
    invoiceIdParam,
    paymentMethod,
    language,
    handleConfirmPayment,
    useWalletBonuses,
    walletUseThb,
    refreshWalletEverywhere,
    acceptedLegalTermsForPayment,
  ])

  return {
    paymentIntent,
    paymentMethod,
    allowedMethods,
    payment,
    processing,
    cryptoModalOpen,
    loadPaymentIntent,
    handleInitiatePayment,
  }
}

export default useCheckoutIntentFlow
