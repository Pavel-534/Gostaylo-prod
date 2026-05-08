import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { GOSTAYLO_WALLET, DEFAULT_ALLOWED_METHODS } from './checkout-constants.js'
import { useCheckoutLoadState } from './useCheckoutLoadState.js'
import { useCheckoutWalletFlow } from './useCheckoutWalletFlow.js'
import { useCheckoutIntentFlow } from './useCheckoutIntentFlow.js'
import { useCheckoutConfirmFlow } from './useCheckoutConfirmFlow.js'

/**
 * @param {object} opts
 * @param {string} opts.bookingId
 * @param {string | null} opts.invoiceIdParam
 * @param {{ id?: string } | null} opts.user
 * @param {boolean} opts.authLoading
 */
export function useCheckoutPayment({ bookingId, invoiceIdParam, user, authLoading }) {
  const queryClient = useQueryClient()
  const [booking, setBooking] = useState(null)
  const [listing, setListing] = useState(null)
  const [invoice, setInvoice] = useState(null)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [chatConversationId, setChatConversationId] = useState(null)
  const [paymentIntent, setPaymentIntent] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('CARD')
  const [allowedMethods, setAllowedMethods] = useState(DEFAULT_ALLOWED_METHODS)
  const [payment, setPayment] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [cryptoModalOpen, setCryptoModalOpen] = useState(false)
  const walletFlow = useCheckoutWalletFlow({ user, booking, queryClient })
  const loadState = useCheckoutLoadState({
    bookingId,
    invoiceIdParam,
    user,
    authLoading,
    setBooking,
    setListing,
    setInvoice,
    setPaymentSuccess,
    setChatConversationId,
    setUseWalletBonuses: walletFlow.setUseWalletBonuses,
    setWalletUseThb: walletFlow.setWalletUseThb,
  })
  const confirmFlow = useCheckoutConfirmFlow({
    bookingId,
    invoiceIdParam,
    language: loadState.language,
    paymentMethod,
    payment,
    acceptedLegalTermsForPayment: walletFlow.acceptedLegalTermsForPayment,
    loadPaymentStatus: loadState.loadPaymentStatus,
    refreshWalletEverywhere: walletFlow.refreshWalletEverywhere,
    setPaymentSuccess,
    setCryptoModalOpen,
  })
  const intentFlow = useCheckoutIntentFlow({
    bookingId,
    invoiceIdParam,
    language: loadState.language,
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
    useWalletBonuses: walletFlow.useWalletBonuses,
    walletUseThb: walletFlow.walletUseThb,
    acceptedLegalTermsForPayment: walletFlow.acceptedLegalTermsForPayment,
    handleConfirmPayment: confirmFlow.handleConfirmPayment,
    refreshWalletEverywhere: walletFlow.refreshWalletEverywhere,
  })

  useEffect(() => {
    if (!booking) return
    loadState.evaluateAccess(booking, user)
  }, [authLoading, booking, user, loadState])

  useEffect(() => {
    const run = async () => {
      const result = await loadState.loadPaymentStatus()
      await intentFlow.loadPaymentIntent(result?.resolvedInvoice)
    }
    run()
  }, [loadState.loadPaymentStatus, intentFlow.loadPaymentIntent])

  return {
    language: loadState.language,
    GOSTAYLO_WALLET,
    DEFAULT_ALLOWED_METHODS,
    loading: loadState.loading,
    accessDenied: loadState.accessDenied,
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
    walletLoading: walletFlow.walletLoading,
    walletBalanceThb: walletFlow.walletBalanceThb,
    walletMaxDiscountPercent: walletFlow.walletMaxDiscountPercent,
    useWalletBonuses: walletFlow.useWalletBonuses,
    setUseWalletBonuses: walletFlow.setUseWalletBonuses,
    walletUseThb: walletFlow.walletUseThb,
    cryptoModalOpen,
    setCryptoModalOpen,
    txId: confirmFlow.txId,
    setTxId: confirmFlow.setTxId,
    paymentSuccess,
    transactionVerificationStep: confirmFlow.transactionVerificationStep,
    confirmations: confirmFlow.confirmations,
    verifying: confirmFlow.verifying,
    txidSubmitted: confirmFlow.txidSubmitted,
    liveVerification: confirmFlow.liveVerification,
    setLiveVerification: confirmFlow.setLiveVerification,
    chatConversationId,
    loadPaymentStatus: loadState.loadPaymentStatus,
    handleInitiatePayment: intentFlow.handleInitiatePayment,
    handleConfirmPayment: confirmFlow.handleConfirmPayment,
    copyToClipboard: confirmFlow.copyToClipboard,
    handleVerifyTxid: confirmFlow.handleVerifyTxid,
    handleSubmitTxid: confirmFlow.handleSubmitTxid,
    checkoutNeedsLegalConsent: walletFlow.checkoutNeedsLegalConsent,
    checkoutLegalConsent: walletFlow.checkoutLegalConsent,
    setCheckoutLegalConsent: walletFlow.setCheckoutLegalConsent,
  }
}
