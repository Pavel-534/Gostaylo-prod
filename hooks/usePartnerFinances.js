'use client'

/**
 * Stage 54.0–55.0 — React state + TanStack Query for `/partner/finances`.
 * Network: `lib/api/partner-finances-client.js`.
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { toast } from 'sonner'
import { getUIText } from '@/lib/translations'
import { useI18n } from '@/contexts/i18n-context'
import { snapshotMoney } from '@/components/partner/finances/partner-finances-shared'
import {
  fetchPartnerPayouts,
  fetchPartnerBalanceBreakdown,
  fetchPartnerBookingsForFinances,
  fetchPartnerFinancesSummary,
  fetchDefaultPartnerPayoutProfile,
  fetchAuthMe,
  fetchExchangeRatesRetail,
  requestPartnerPayout,
  fetchFinancesStatementPdf,
} from '@/lib/api/partner-finances-client'

export function usePartnerFinances() {
  const { language } = useI18n()
  const t = (key) => getUIText(key, language)
  const searchParams = useSearchParams()
  const escrowBookingFilter = searchParams.get('status') === 'PAID_ESCROW'
  const transactionSectionRef = useRef(null)

  const [partnerId, setPartnerId] = useState(null)
  const [currency, setCurrency] = useState('THB')
  const [exchangeRates, setExchangeRates] = useState({ THB: 1 })
  const [defaultPayoutProfile, setDefaultPayoutProfile] = useState(null)
  const [pdfDateFrom, setPdfDateFrom] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [pdfDateTo, setPdfDateTo] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [pdfLoading, setPdfLoading] = useState(false)
  const [financeFocusBooking, setFinanceFocusBooking] = useState(null)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false)
  const [partnerProfileVerified, setPartnerProfileVerified] = useState(null)

  useEffect(() => {
    const storedUser = localStorage.getItem('gostaylo_user')
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser)
        setPartnerId(user.id)
        const pref =
          String(
            user.preferredPayoutCurrency ||
              user.preferred_payout_currency ||
              user.preferredCurrency ||
              user.preferred_currency ||
              'THB',
          )
            .toUpperCase()
            .trim() || 'THB'
        setCurrency(pref)
      } catch (e) {
        console.error('[FINANCES] Failed to parse user', e)
      }
    }
  }, [])

  useEffect(() => {
    if (!partnerId) return
    let cancelled = false
    ;(async () => {
      try {
        const profile = await fetchDefaultPartnerPayoutProfile()
        if (!cancelled) setDefaultPayoutProfile(profile)
      } catch {
        if (!cancelled) setDefaultPayoutProfile(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [partnerId])

  const calcPayoutMath = (baseAmount) => {
    const base = Math.max(0, Number(baseAmount) || 0)
    const method = defaultPayoutProfile?.method
    if (!method) return { fee: 0, final: base }
    const feeType = String(method.fee_type || 'fixed').toLowerCase()
    const feeValue = Math.max(0, Number(method.value) || 0)
    const minPayout = Math.max(0, Number(method.min_payout) || 0)
    if (base < minPayout) return { fee: 0, final: base, minPayoutError: true, minPayout }
    const fee =
      feeType === 'percentage'
        ? Math.round(base * (feeValue / 100) * 100) / 100
        : Math.round(feeValue * 100) / 100
    const final = Math.max(0, Math.round((base - fee) * 100) / 100)
    return { fee, final, feeType, feeValue }
  }

  useEffect(() => {
    let isMounted = true
    ;(async () => {
      try {
        const [me, ratesMap] = await Promise.all([fetchAuthMe(), fetchExchangeRatesRetail()])

        if (me.ok && me.user) {
          const verified = me.user?.is_verified === true || me.user?.isVerified === true
          if (isMounted) {
            setPartnerProfileVerified(verified)
          }
          const pref =
            String(
              me.user?.preferredPayoutCurrency ||
                me.user?.preferred_payout_currency ||
                me.user?.preferredCurrency ||
                me.user?.preferred_currency ||
                'THB',
            )
              .toUpperCase()
              .trim() || 'THB'
          if (isMounted) setCurrency(pref)
        } else if (isMounted) {
          setPartnerProfileVerified(false)
        }

        if (ratesMap && isMounted) {
          setExchangeRates(ratesMap)
        }
      } catch (e) {
        console.warn('[FINANCES] failed to load payout preferences/rates', e)
      }
    })()

    return () => {
      isMounted = false
    }
  }, [])

  const {
    data: bookings = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['partner-finances', partnerId],
    queryFn: () => fetchPartnerBookingsForFinances(partnerId),
    enabled: !!partnerId,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  })

  const displayedBookings = useMemo(() => {
    if (!escrowBookingFilter) return bookings
    return bookings.filter((b) => String(b.status || '').toUpperCase() === 'PAID_ESCROW')
  }, [bookings, escrowBookingFilter])

  useEffect(() => {
    if (!escrowBookingFilter || isLoading) return
    const id = requestAnimationFrame(() => {
      transactionSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => cancelAnimationFrame(id)
  }, [escrowBookingFilter, isLoading, partnerId])

  const {
    data: financesSummary,
    isLoading: summaryLoading,
    isError: summaryError,
    error: summaryErr,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['partner-finances-summary', partnerId],
    queryFn: () => fetchPartnerFinancesSummary(),
    enabled: !!partnerId,
    staleTime: 30 * 1000,
  })

  const {
    data: payouts = [],
    isLoading: payoutsLoading,
    isError: payoutsError,
    error: payoutsErr,
    refetch: refetchPayouts,
  } = useQuery({
    queryKey: ['partner-payouts-history'],
    queryFn: () => fetchPartnerPayouts(),
    staleTime: 30 * 1000,
  })

  const { data: balanceBreakdown } = useQuery({
    queryKey: ['partner-balance-breakdown', partnerId],
    queryFn: () => fetchPartnerBalanceBreakdown(),
    enabled: !!partnerId,
    staleTime: 30 * 1000,
  })

  const pendingPayoutPreview = calcPayoutMath(financesSummary?.availableThb ?? 0)
  const summaryLoadingCombined = isLoading || summaryLoading

  const handleWithdrawSubmit = async () => {
    if (!partnerId) {
      toast.error(t('partnerFinances_withdrawErrorToast'))
      return
    }
    setWithdrawSubmitting(true)
    try {
      const { res, json } = await requestPartnerPayout({
        partnerId,
        availableThb: financesSummary?.availableThb ?? 0,
        payoutPreviewFinal: pendingPayoutPreview.final,
        payoutFee: pendingPayoutPreview.fee,
        payoutProfileId: defaultPayoutProfile?.id ?? null,
        payoutMethodId: defaultPayoutProfile?.method_id ?? defaultPayoutProfile?.method?.id ?? null,
        profileSnapshot: defaultPayoutProfile
          ? {
              methodName: defaultPayoutProfile.method?.name,
              channel: defaultPayoutProfile.method?.channel,
              data: defaultPayoutProfile.data,
            }
          : null,
      })
      if (!res.ok || json?.success === false) {
        if (
          res.status === 403 &&
          (json?.code === 'PROFILE_NOT_VERIFIED' || json?.error === 'PROFILE_NOT_VERIFIED')
        ) {
          toast.error(t('partnerFinances_payoutKycBlockedHint'))
          return
        }
        throw new Error(json?.error || 'HTTP')
      }
      toast.success(t('partnerFinances_withdrawSuccessToast'))
      setWithdrawOpen(false)
    } catch {
      toast.error(t('partnerFinances_withdrawErrorToast'))
    } finally {
      setWithdrawSubmitting(false)
    }
  }

  const handleExportCSV = () => {
    if (bookings.length === 0) {
      toast.error(t('noTransactionsExport'))
      return
    }

    const csvRows = [
      [
        'Date',
        'Booking ID',
        t('partnerFinances_csvCategory'),
        t('listing'),
        t('guest'),
        'Status',
        t('gross'),
        t('fee'),
        t('netEarnings'),
      ].join(','),
      ...bookings.map((b) => {
        const { gross, fee, net } = snapshotMoney(b)
        const categorySlug = String(b.financial_snapshot?.category_slug ?? '').replace(/"/g, '""')
        return [
          format(new Date(b.createdAt || b.created_at), 'yyyy-MM-dd'),
          b.id,
          `"${categorySlug}"`,
          `"${b.listing?.title || 'N/A'}"`,
          `"${b.guestName || b.guest_name || 'N/A'}"`,
          b.status,
          gross.toFixed(2),
          fee.toFixed(2),
          net.toFixed(2),
        ].join(',')
      }),
    ]

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gostaylo-finances-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)

    toast.success(t('reportDownloaded'))
  }

  const handleExportPdf = async () => {
    if (!pdfDateFrom || !pdfDateTo || pdfDateFrom > pdfDateTo) {
      toast.error(t('partnerFinances_pdfError'))
      return
    }
    setPdfLoading(true)
    try {
      const blob = await fetchFinancesStatementPdf({ from: pdfDateFrom, to: pdfDateTo })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `gostaylo-financial-statement-${pdfDateFrom}_${pdfDateTo}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(t('partnerFinances_pdfSuccess'))
    } catch (e) {
      toast.error(e?.message || t('partnerFinances_pdfError'))
    } finally {
      setPdfLoading(false)
    }
  }

  const applyPdfMonthPreset = (which) => {
    const now = new Date()
    const ref = which === 'prev' ? subMonths(now, 1) : now
    setPdfDateFrom(format(startOfMonth(ref), 'yyyy-MM-dd'))
    setPdfDateTo(format(endOfMonth(ref), 'yyyy-MM-dd'))
  }

  return {
    language,
    t,
    escrowBookingFilter,
    transactionSectionRef,
    partnerId,
    currency,
    exchangeRates,
    defaultPayoutProfile,
    pdfDateFrom,
    setPdfDateFrom,
    pdfDateTo,
    setPdfDateTo,
    pdfLoading,
    financeFocusBooking,
    setFinanceFocusBooking,
    withdrawOpen,
    setWithdrawOpen,
    withdrawSubmitting,
    partnerProfileVerified,
    bookings,
    displayedBookings,
    isLoading,
    isError,
    error,
    refetch,
    financesSummary,
    summaryLoading,
    summaryError,
    summaryErr,
    refetchSummary,
    payouts,
    payoutsLoading,
    payoutsError,
    payoutsErr,
    refetchPayouts,
    balanceBreakdown,
    pendingPayoutPreview,
    summaryLoadingCombined,
    handleWithdrawSubmit,
    handleExportCSV,
    handleExportPdf,
    applyPdfMonthPreset,
    calcPayoutMath,
  }
}
