import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { getUIText } from '@/lib/translations'
import { LEGAL_CONSENT_ERROR_CODE } from '@/lib/legal-consent'

export function useCheckoutConfirmFlow({
  bookingId,
  invoiceIdParam,
  language,
  paymentMethod,
  payment,
  acceptedLegalTermsForPayment,
  loadPaymentStatus,
  refreshWalletEverywhere,
  setPaymentSuccess,
  setCryptoModalOpen,
}) {
  const [txId, setTxId] = useState('')
  const [verificationStep, setVerificationStep] = useState(0)
  const [confirmations, setConfirmations] = useState(0)
  const [verifying, setVerifying] = useState(false)
  const [txidSubmitted, setTxidSubmitted] = useState(false)
  const [liveVerification, setLiveVerification] = useState(null)

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
          const verifyRes = await fetch('/api/v2/payments/verify-tron', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              txid: transactionId,
              bookingId,
              acceptedLegalTerms: acceptedLegalTermsForPayment,
            }),
          })
          const verifyData = await verifyRes.json()
          if (
            !verifyRes.ok &&
            (verifyData?.code === LEGAL_CONSENT_ERROR_CODE || verifyData?.status === LEGAL_CONSENT_ERROR_CODE)
          ) {
            toast.error(getUIText('checkout_legalConsentRequiredToast', language))
            setVerifying(false)
            setVerificationStep(0)
            return
          }
          if (!verifyData.success) {
            toast.error(verifyData.error || getUIText('checkout_toast_txNotVerified', language))
            setVerifying(false)
            setVerificationStep(0)
            return
          }
          setVerificationStep(3)
          toast.success(getUIText('checkout_toast_chainOk', language))
          await new Promise((r) => setTimeout(r, 500))
          if (verifyData.paymentSettled?.success === true) {
            setPaymentSuccess(true)
            setCryptoModalOpen(false)
            await loadPaymentStatus()
            await refreshWalletEverywhere()
          } else {
            toast.error(verifyData.paymentSettled?.error || getUIText('checkout_toast_paymentConfirmFail', language))
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
            acceptedLegalTerms: acceptedLegalTermsForPayment,
          }),
        })
        const data = await res.json()
        if (data.code === LEGAL_CONSENT_ERROR_CODE) {
          toast.error(getUIText('checkout_legalConsentRequiredToast', language))
          return
        }
        if (data.success) {
          toast.success(getUIText('checkout_toast_paymentOk', language))
          setPaymentSuccess(true)
          setCryptoModalOpen(false)
          await loadPaymentStatus()
          await refreshWalletEverywhere()
        } else {
          toast.error(data.error || getUIText('checkout_toast_paymentConfirmFail', language))
        }
      } catch (error) {
        console.error('Failed to confirm payment:', error)
        toast.error(getUIText('checkout_toast_paymentConfirmFail', language))
      }
    },
    [
      paymentMethod,
      bookingId,
      language,
      payment,
      txId,
      invoiceIdParam,
      loadPaymentStatus,
      refreshWalletEverywhere,
      acceptedLegalTermsForPayment,
      setPaymentSuccess,
      setCryptoModalOpen,
    ],
  )

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
        body: JSON.stringify({
          txid: txId,
          bookingId,
          acceptedLegalTerms: acceptedLegalTermsForPayment,
        }),
      })
      const data = await res.json()
      setLiveVerification(data)
      if (
        (!res.ok && (data.code === LEGAL_CONSENT_ERROR_CODE || data.status === LEGAL_CONSENT_ERROR_CODE)) ||
        (data.code === LEGAL_CONSENT_ERROR_CODE && !data.success) ||
        (data.status === LEGAL_CONSENT_ERROR_CODE && !data.success)
      ) {
        toast.error(getUIText('checkout_legalConsentRequiredToast', language))
        return
      }
      if (data.success) {
        toast.success(getUIText('checkout_toast_txFound', language))
        if (data.paymentSettled?.success === true) {
          toast.success(language === 'ru' ? 'Платёж и эскроу обновлены' : 'Payment and escrow updated')
          setPaymentSuccess(true)
          setCryptoModalOpen(false)
          void loadPaymentStatus()
          void refreshWalletEverywhere()
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
  }, [
    txId,
    bookingId,
    language,
    loadPaymentStatus,
    refreshWalletEverywhere,
    acceptedLegalTermsForPayment,
    setPaymentSuccess,
    setCryptoModalOpen,
  ])

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
    txId,
    setTxId,
    transactionVerificationStep: verificationStep,
    confirmations,
    verifying,
    txidSubmitted,
    liveVerification,
    setLiveVerification,
    handleConfirmPayment,
    handleVerifyTxid,
    handleSubmitTxid,
    copyToClipboard,
  }
}

export default useCheckoutConfirmFlow
