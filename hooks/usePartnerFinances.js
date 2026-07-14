'use client'

/**
 * Stage 54.0–55.0 — React state + TanStack Query for `/partner/finances`.
 * Network: `lib/api/partner-finances-client.js`.
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { toast } from 'sonner'
import { getUIText } from '@/lib/translations'
import { useI18n } from '@/contexts/i18n-context'
import { snapshotMoney } from '@/components/partner/finances/partner-finances-shared'
import { payoutPreviewAmountKey } from '@/lib/partner/partner-payout-preview-api'
import {
  fetchPartnerPayouts,
  fetchPartnerBalanceBreakdown,
  fetchPartnerBookingsForFinances,
  fetchPartnerFinancesSummary,
  fetchDefaultPartnerPayoutProfile,
  fetchPartnerPayoutProfiles,
  fetchAuthMe,
  fetchPartnerPayoutPreview,
  fetchPartnerPayoutPreviewBatch,
  requestPartnerPayout,
  fetchFinancesStatementPdf,
} from '@/lib/api/partner-finances-client'

export const PARTNER_LEDGER_PAGE_SIZE = 40

export function usePartnerFinances() {
  const queryClient = useQueryClient()
  const { language } = useI18n()
  const t = (key) => getUIText(key, language)
  const searchParams = useSearchParams()
  const escrowBookingFilter = searchParams.get('status') === 'PAID_ESCROW'
  const deepLinkLedgerEntryId = searchParams.get('ledgerEntry')
  const transactionSectionRef = useRef(null)
  const [ledgerExtraPages, setLedgerExtraPages] = useState([])
  const [ledgerLoadingMore, setLedgerLoadingMore] = useState(false)
  const balanceDataUpdatedAtRef = useRef(0)

  const [partnerId, setPartnerId] = useState(null)
  const [defaultPayoutProfile, setDefaultPayoutProfile] = useState(null)
  const [payoutProfiles, setPayoutProfiles] = useState([])
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
        const [profile, profiles] = await Promise.all([
          fetchDefaultPartnerPayoutProfile(),
          fetchPartnerPayoutProfiles(),
        ])
        if (!cancelled) {
          setDefaultPayoutProfile(profile)
          setPayoutProfiles(profiles || [])
        }
      } catch {
        if (!cancelled) {
          setDefaultPayoutProfile(null)
          setPayoutProfiles([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [partnerId])

  useEffect(() => {
    let isMounted = true
    ;(async () => {
      try {
        const me = await fetchAuthMe()
        if (me.ok && me.user) {
          const verified = me.user?.is_verified === true || me.user?.isVerified === true
          if (isMounted) setPartnerProfileVerified(verified)
        } else if (isMounted) {
          setPartnerProfileVerified(false)
        }
      } catch (e) {
        console.warn('[FINANCES] failed to load profile', e)
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

  const {
    data: balanceBreakdownRaw,
    dataUpdatedAt: balanceDataUpdatedAt,
  } = useQuery({
    queryKey: ['partner-balance-breakdown', partnerId],
    queryFn: () =>
      fetchPartnerBalanceBreakdown({ limit: PARTNER_LEDGER_PAGE_SIZE, offset: 0 }),
    enabled: !!partnerId,
    staleTime: 30 * 1000,
  })

  useEffect(() => {
    if (balanceDataUpdatedAtRef.current !== balanceDataUpdatedAt) {
      balanceDataUpdatedAtRef.current = balanceDataUpdatedAt
      setLedgerExtraPages([])
    }
  }, [balanceDataUpdatedAt])

  const { data: resolvedLedgerEntryData } = useQuery({
    queryKey: ['partner-ledger-entry-resolve', partnerId, deepLinkLedgerEntryId],
    queryFn: () =>
      fetchPartnerBalanceBreakdown({
        limit: 0,
        offset: 0,
        ledgerEntry: deepLinkLedgerEntryId,
      }),
    enabled: !!partnerId && !!deepLinkLedgerEntryId,
    staleTime: 60 * 1000,
  })

  const resolvedLedgerEntry =
    resolvedLedgerEntryData?.resolvedLedgerEntry ?? balanceBreakdownRaw?.resolvedLedgerEntry ?? null

  const ledgerTransactions = useMemo(() => {
    const firstPage = balanceBreakdownRaw?.recentLedgerTransactions || []
    if (!ledgerExtraPages.length) return firstPage
    const extra = ledgerExtraPages.flatMap((page) => page.recentLedgerTransactions || [])
    return [...firstPage, ...extra]
  }, [balanceBreakdownRaw?.recentLedgerTransactions, ledgerExtraPages])

  const ledgerHasMore = useMemo(() => {
    if (ledgerExtraPages.length > 0) {
      const last = ledgerExtraPages[ledgerExtraPages.length - 1]
      return last?.ledgerPagination?.hasMore === true
    }
    return balanceBreakdownRaw?.ledgerPagination?.hasMore === true
  }, [balanceBreakdownRaw?.ledgerPagination?.hasMore, ledgerExtraPages])

  const balanceBreakdown = useMemo(() => {
    if (!balanceBreakdownRaw) return balanceBreakdownRaw
    return {
      ...balanceBreakdownRaw,
      recentLedgerTransactions: ledgerTransactions,
    }
  }, [balanceBreakdownRaw, ledgerTransactions])

  const loadMoreLedger = useCallback(async () => {
    if (!partnerId || ledgerLoadingMore || !ledgerHasMore) return
    setLedgerLoadingMore(true)
    try {
      const offset = ledgerTransactions.length
      const page = await fetchPartnerBalanceBreakdown({
        limit: PARTNER_LEDGER_PAGE_SIZE,
        offset,
      })
      setLedgerExtraPages((prev) => [...prev, page])
    } catch (e) {
      console.warn('[FINANCES] ledger load more failed', e)
      toast.error(t('partnerFinances_ledgerLoadMoreError'))
    } finally {
      setLedgerLoadingMore(false)
    }
  }, [partnerId, ledgerLoadingMore, ledgerHasMore, ledgerTransactions.length, t])

  const {
    data: payoutPreview,
    isLoading: payoutPreviewLoading,
    refetch: refetchPayoutPreview,
  } = useQuery({
    queryKey: ['partner-payout-preview', partnerId, defaultPayoutProfile?.id],
    queryFn: () =>
      fetchPartnerPayoutPreview({
        payoutProfileId: defaultPayoutProfile?.id,
      }),
    enabled: !!partnerId && !!defaultPayoutProfile?.id,
    staleTime: 30 * 1000,
  })

  const previewBatchAmounts = useMemo(() => {
    const amounts = new Set()
    for (const b of displayedBookings) {
      const { net } = snapshotMoney(b)
      if (net > 0) amounts.add(Math.round(net * 100) / 100)
    }
    const portfolioNet = Number(financesSummary?.portfolio?.netThb)
    if (Number.isFinite(portfolioNet) && portfolioNet > 0) {
      amounts.add(Math.round(portfolioNet * 100) / 100)
    }
    return [...amounts]
  }, [displayedBookings, financesSummary?.portfolio?.netThb])

  const previewBatchAmountsKey = previewBatchAmounts.join(',')

  const { data: payoutPreviewBatch, isLoading: payoutPreviewBatchLoading } = useQuery({
    queryKey: [
      'partner-payout-preview-batch',
      partnerId,
      defaultPayoutProfile?.id,
      previewBatchAmountsKey,
    ],
    queryFn: () =>
      fetchPartnerPayoutPreviewBatch({
        amountsThb: previewBatchAmounts,
        payoutProfileId: defaultPayoutProfile?.id,
      }),
    enabled: !!partnerId && !!defaultPayoutProfile?.id && previewBatchAmounts.length > 0,
    staleTime: 30 * 1000,
  })

  const payoutPreviewByAmountKey = payoutPreviewBatch?.byAmountKey || {}

  const getBookingPayoutPreview = (booking) => {
    const { net } = snapshotMoney(booking)
    return payoutPreviewByAmountKey[payoutPreviewAmountKey(net)] || null
  }

  const summaryLoadingCombined = isLoading || summaryLoading

  const handleWithdrawSubmit = async ({ payoutProfileId, amountThb } = {}) => {
    if (!partnerId) {
      toast.error(t('partnerFinances_withdrawErrorToast'))
      return
    }
    setWithdrawSubmitting(true)
    try {
      const withdrawAmount = Number(
        amountThb ?? payoutPreview?.baseAmountThb ?? payoutPreview?.availableThb ?? 0,
      )
      if (!Number.isFinite(withdrawAmount) || withdrawAmount <= 0) {
        toast.error(t('partnerFinances_withdrawErrorToast'))
        return
      }
      const { res, json } = await requestPartnerPayout({
        partnerId,
        amount: withdrawAmount,
        method: 'MANUAL',
        payoutProfileId: payoutProfileId ?? defaultPayoutProfile?.id ?? null,
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
      void queryClient.invalidateQueries({ queryKey: ['partner-finances-summary', partnerId] })
      void queryClient.invalidateQueries({ queryKey: ['partner-payouts-history'] })
      void queryClient.invalidateQueries({ queryKey: ['partner-balance-breakdown', partnerId] })
      void queryClient.invalidateQueries({ queryKey: ['partner-payout-preview', partnerId] })
      void queryClient.invalidateQueries({ queryKey: ['partner-payout-preview-batch', partnerId] })
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
    deepLinkLedgerEntryId,
    resolvedLedgerEntry,
    transactionSectionRef,
    partnerId,
    defaultPayoutProfile,
    payoutProfiles,
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
    ledgerHasMore,
    ledgerLoadingMore,
    loadMoreLedger,
    payoutPreview,
    payoutPreviewLoading,
    refetchPayoutPreview,
    payoutPreviewByAmountKey,
    payoutPreviewBatchLoading,
    getBookingPayoutPreview,
    summaryLoadingCombined,
    handleWithdrawSubmit,
    handleExportCSV,
    handleExportPdf,
    applyPdfMonthPreset,
  }
}
