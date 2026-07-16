import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { formatPrice, priceRawForTest, languageToNumberLocale } from '@/lib/currency'
import { getUIText, getAuthErrorMessage } from '@/lib/translations'
import { useCommission } from '@/hooks/use-commission'
import { computeRoundedGuestTotal } from '@/lib/booking-price-integrity'
import { usePricingEngineConfig } from '@/hooks/use-pricing-engine-config'
import { buildGuestPriceBreakdownFromCheckoutTotals } from '@/lib/booking/guest-price-breakdown'
import { getGuestPayableRoundedThb } from '@/lib/booking-guest-total'
import { interpolateTemplate } from './interpolate.js'
import { getInvoiceGuestAmountPresentation } from '@/lib/pricing/fx-display-client'
import { useFxRatesQuery } from '@/lib/hooks/use-fx-rates-query'

/**
 * Курсы, комиссия, промокод и производные суммы для чекаута.
 * @param {object} opts
 * @param {object | null} opts.booking
 * @param {object | null} opts.invoice
 * @param {string} opts.paymentMethod
 * @param {(v: string) => void} opts.setPaymentMethod
 * @param {string[]} opts.allowedMethods
 * @param {string} opts.language
 */
export function useCheckoutPricing({
  booking,
  invoice,
  paymentMethod,
  setPaymentMethod,
  allowedMethods,
  language,
  walletUseThb = 0,
  guestUiCurrency = 'THB',
}) {
  const searchParams = useSearchParams()
  const commissionFromApi = useCommission()
  const { roundingMode } = usePricingEngineConfig()
  const { data: exchangeRates = { THB: 1 } } = useFxRatesQuery({ retail: true })
  const thbPerUsdt = exchangeRates?.USDT != null ? exchangeRates.USDT : null
  const [promoCode, setPromoCode] = useState('')
  const [promoDiscount, setPromoDiscount] = useState(null)
  const [promoLoading, setPromoLoading] = useState(false)

  useEffect(() => {
    const pm = searchParams.get('pm')
    if (pm === 'CRYPTO') setPaymentMethod('CRYPTO')
    if (pm === 'CARD') setPaymentMethod('CARD')
    if (pm === 'MIR') setPaymentMethod('MIR')
  }, [searchParams, setPaymentMethod])

  useEffect(() => {
    if (searchParams.get('pm')) return
    const preferred = String(invoice?.payment_method || '').toUpperCase()
    if (preferred === 'CRYPTO' || preferred === 'CARD' || preferred === 'MIR') {
      setPaymentMethod(preferred)
    }
  }, [invoice?.payment_method, searchParams, setPaymentMethod])

  useEffect(() => {
    if (!Array.isArray(allowedMethods) || allowedMethods.length === 0) return
    if (!allowedMethods.includes(paymentMethod)) {
      setPaymentMethod(allowedMethods[0])
    }
  }, [allowedMethods, paymentMethod, setPaymentMethod])

  const handleApplyPromoCode = useCallback(async () => {
    if (!promoCode.trim()) {
      toast.error(getUIText('checkout_toast_promoEmpty', language))
      return
    }
    if (booking?.priceThb == null) {
      toast.error(getUIText('checkout_toast_promoCheckFail', language))
      return
    }
    setPromoLoading(true)
    try {
      const res = await fetch('/api/v2/promo-codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: promoCode,
          bookingAmount: booking.priceThb,
          listingId: booking.listing_id || booking.listings?.id || null,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setPromoDiscount(data.data)
        toast.success(
          interpolateTemplate(getUIText('checkout_toast_promoOk', language), {
            amount: String(data.data.discountAmount),
          }),
        )
      } else {
        const msg = data.error_code
          ? getAuthErrorMessage(data.error_code, language, { minAmountThb: data.min_amount_thb })
          : getUIText('checkout_toast_promoInvalid', language)
        toast.error(msg)
        setPromoDiscount(null)
      }
    } catch (error) {
      console.error('Failed to apply promo code:', error)
      toast.error(getUIText('checkout_toast_promoCheckFail', language))
    } finally {
      setPromoLoading(false)
    }
  }, [promoCode, booking, language])

  const guestServiceFeePercent =
    !commissionFromApi.loading && Number.isFinite(commissionFromApi.guestServiceFeePercent)
      ? Number(commissionFromApi.guestServiceFeePercent)
      : 5

  const {
    discountAmount,
    priceAfterDiscount,
    serviceFee,
    totalWithFee,
    roundingDiffPot,
    invoiceAmount,
    invoiceCurrency,
    hasInvoiceCheckout,
    payableText,
    payableSecondaryText,
    guestCheckoutBreakdown,
    walletAppliedThb,
    serviceFeeBeforeWallet,
    serviceFeeAfterWallet,
  } = useMemo(() => {
    const discountAmount = promoDiscount?.discountAmount || 0
    const priceAfterDiscount = (booking?.priceThb ?? 0) - discountAmount

    const snap =
      booking?.pricing_snapshot && typeof booking.pricing_snapshot === 'object'
        ? booking.pricing_snapshot
        : {}
    const fs = snap.fee_split_v2 && typeof snap.fee_split_v2 === 'object' ? snap.fee_split_v2 : {}
    const taxSnap = snap.tax && typeof snap.tax === 'object' ? snap.tax : {}
    const taxRatePercent = Number(fs.tax_rate_percent ?? taxSnap.rate_percent ?? 0) || 0

    const serviceFee = promoDiscount
      ? Math.round(priceAfterDiscount * (guestServiceFeePercent / 100))
      : Math.round((booking?.commissionThb || 0) || 0)
    const taxAmountCheckout = promoDiscount
      ? Math.round(priceAfterDiscount * (taxRatePercent / 100))
      : Math.round(Number(fs.tax_amount_thb ?? taxSnap.amount_thb ?? 0) || 0)

    const serviceFeeBeforeWallet = Math.max(0, Math.round(serviceFee))
    const walletAppliedThb = Math.max(
      0,
      Math.min(Math.round(Number(walletUseThb || 0)), serviceFeeBeforeWallet),
    )
    const serviceFeeAfterWallet = Math.max(0, serviceFeeBeforeWallet - walletAppliedThb)
    const guestTotalBeforeRounding = priceAfterDiscount + taxAmountCheckout + serviceFeeAfterWallet
    const promoRounded = promoDiscount
      ? computeRoundedGuestTotal(guestTotalBeforeRounding, roundingMode)
      : null
    const roundingDiffPot = promoDiscount
      ? promoRounded?.roundingPotThb ?? promoRounded?.roundingDiffPotThb ?? 0
      : Math.max(0, Math.round(Number(booking?.roundingDiffPot) || 0))
    const totalWithFee = promoDiscount
      ? promoRounded?.roundedGuestTotalThb || Math.round(guestTotalBeforeRounding)
      : booking
        ? getGuestPayableRoundedThb(booking)
        : Math.round(guestTotalBeforeRounding + roundingDiffPot)
    const invoiceAmount = Number(invoice?.amount || 0)
    const invoiceCurrency = String(invoice?.currency || 'THB').toUpperCase()
    const hasInvoiceCheckout = Boolean(invoice?.id && Number.isFinite(invoiceAmount) && invoiceAmount > 0)
    let payableText = formatPrice(totalWithFee, booking?.currency || 'THB', exchangeRates, language)
    let payableSecondaryText = null
    if (hasInvoiceCheckout && invoice) {
      const pres = getInvoiceGuestAmountPresentation({
        invoice: {
          amount: invoiceAmount,
          currency: invoiceCurrency,
          amount_thb: invoice.amount_thb ?? invoice.metadata?.amount_thb,
        },
        guestUiCurrency,
        rateMap: exchangeRates,
        language,
      })
      payableText = pres.primary.label
      payableSecondaryText = pres.secondary?.label ?? null
    }

    const insuranceThb = Number(fs.insurance_reserve_thb)
    const insuranceOk = Number.isFinite(insuranceThb) ? insuranceThb : 0

    const guestCheckoutBreakdown =
      !booking || hasInvoiceCheckout
        ? null
        : buildGuestPriceBreakdownFromCheckoutTotals({
            listPriceThb: booking.priceThb ?? 0,
            discountThb: discountAmount,
            promoCode: promoDiscount?.code || null,
            serviceTariffThb: priceAfterDiscount,
            taxAmountThb: taxAmountCheckout,
            taxRatePercent,
            platformFeeThb: serviceFeeAfterWallet,
            roundingThb: roundingDiffPot,
            insuranceThb: insuranceOk,
            totalThb: totalWithFee,
          })

    return {
      discountAmount,
      priceAfterDiscount,
      serviceFee,
      totalWithFee,
      roundingDiffPot,
      invoiceAmount,
      invoiceCurrency,
      hasInvoiceCheckout,
      payableText,
      payableSecondaryText,
      guestCheckoutBreakdown,
      walletAppliedThb,
      serviceFeeBeforeWallet,
      serviceFeeAfterWallet,
    }
  }, [booking, promoDiscount, guestServiceFeePercent, exchangeRates, language, invoice, walletUseThb, guestUiCurrency])

  const formatDisplayPrice = useCallback(
    (n, c) => formatPrice(n, c, exchangeRates, language),
    [exchangeRates, language],
  )

  const dateNumberLocale = languageToNumberLocale(language)

  return {
    language, // from parent (useCheckoutPayment)
    dateNumberLocale,
    exchangeRates,
    thbPerUsdt,
    promoCode,
    setPromoCode,
    promoDiscount,
    promoLoading,
    handleApplyPromoCode,
    guestServiceFeePercent,
    commissionLoading: commissionFromApi.loading,
    discountAmount,
    priceAfterDiscount,
    serviceFee,
    totalWithFee,
    roundingDiffPot,
    invoiceAmount,
    invoiceCurrency,
    hasInvoiceCheckout,
    payableText,
    payableSecondaryText,
    guestCheckoutBreakdown,
    walletAppliedThb,
    serviceFeeBeforeWallet,
    serviceFeeAfterWallet,
    formatDisplayPrice,
    priceRawForTest: (n, c) => priceRawForTest(n, c, exchangeRates),
    interpolateTemplate,
  }
}
