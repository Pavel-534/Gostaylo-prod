import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { formatPrice, priceRawForTest, languageToNumberLocale } from '@/lib/currency'
import { getUIText } from '@/lib/translations'
import { useCommission } from '@/hooks/use-commission'
import { computeRoundedGuestTotalPot } from '@/lib/booking-price-integrity'
import { buildGuestPriceBreakdownFromCheckoutTotals } from '@/lib/booking/guest-price-breakdown'
import { interpolateTemplate } from './interpolate.js'

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
export function useCheckoutPricing({ booking, invoice, paymentMethod, setPaymentMethod, allowedMethods, language }) {
  const searchParams = useSearchParams()
  const commissionFromApi = useCommission()
  const [exchangeRates, setExchangeRates] = useState({ THB: 1 })
  const [thbPerUsdt, setThbPerUsdt] = useState(null)
  const [promoCode, setPromoCode] = useState('')
  const [promoDiscount, setPromoDiscount] = useState(null)
  const [promoLoading, setPromoLoading] = useState(false)

  useEffect(() => {
    fetch('/api/v2/exchange-rates', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (j.success && j.rateMap && typeof j.rateMap === 'object') {
          setExchangeRates({ THB: 1, ...j.rateMap })
          if (j.rateMap.USDT != null) setThbPerUsdt(j.rateMap.USDT)
        }
      })
      .catch(() => {})
  }, [])

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
        toast.error(data.error || getUIText('checkout_toast_promoInvalid', language))
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
    guestCheckoutBreakdown,
  } = useMemo(() => {
    const discountAmount = promoDiscount?.discountAmount || 0
    const priceAfterDiscount = (booking?.priceThb ?? 0) - discountAmount
    const serviceFee = promoDiscount
      ? Math.round(priceAfterDiscount * (guestServiceFeePercent / 100))
      : Math.round((booking?.commissionThb || 0) || 0)
    const guestTotalBeforeRounding = priceAfterDiscount + serviceFee
    const promoRounded = promoDiscount ? computeRoundedGuestTotalPot(guestTotalBeforeRounding) : null
    const roundingDiffPot = promoDiscount
      ? promoRounded?.roundingDiffPotThb || 0
      : Math.max(0, Math.round(Number(booking?.roundingDiffPot) || 0))
    const totalWithFee = promoDiscount
      ? promoRounded?.roundedGuestTotalThb || Math.round(guestTotalBeforeRounding)
      : Math.round(guestTotalBeforeRounding + roundingDiffPot)
    const invoiceAmount = Number(invoice?.amount || 0)
    const invoiceCurrency = String(invoice?.currency || 'THB').toUpperCase()
    const hasInvoiceCheckout = Boolean(invoice?.id && Number.isFinite(invoiceAmount) && invoiceAmount > 0)
    const payableText = hasInvoiceCheckout
      ? `${invoiceCurrency === 'THB' ? '฿' : invoiceCurrency === 'RUB' ? '₽' : '$'}${invoiceAmount.toLocaleString()} ${invoiceCurrency}`
      : formatPrice(totalWithFee, booking?.currency || 'THB', exchangeRates, language)

    const snap =
      booking?.pricing_snapshot && typeof booking.pricing_snapshot === 'object'
        ? booking.pricing_snapshot
        : {}
    const fs = snap.fee_split_v2 && typeof snap.fee_split_v2 === 'object' ? snap.fee_split_v2 : {}
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
            platformFeeThb: serviceFee,
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
      guestCheckoutBreakdown,
    }
  }, [booking, promoDiscount, guestServiceFeePercent, exchangeRates, language, invoice])

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
    guestCheckoutBreakdown,
    formatDisplayPrice,
    priceRawForTest: (n, c) => priceRawForTest(n, c, exchangeRates),
    interpolateTemplate,
  }
}
