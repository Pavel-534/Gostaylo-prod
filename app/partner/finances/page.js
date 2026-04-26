'use client'

/**
 * GoStayLo Partner Finances v2 - Real-time Revenue Dashboard
 * 
 * Features:
 * - TanStack Query for reactive data
 * - Dynamic commission (per-booking or global fallback)
 * - Transaction breakdown by booking status
 * - Downloadable financial reports
 * - i18n translations
 * 
 * @version 2.1
 */

import { useState, useEffect, useMemo, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  Wallet, Download, FileDown, Receipt,
  Calendar, Clock, ArrowDownToLine, Loader2, Shield, Banknote, TrendingUp,
  Home, Car, Briefcase, MapPin,
} from 'lucide-react'
import { formatPrice } from '@/lib/currency'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { toast } from 'sonner'
import { getUIText } from '@/lib/translations'
import { useI18n } from '@/contexts/i18n-context'
import { PartnerFinancialSnapshotDialog } from '@/components/partner/PartnerFinancialSnapshotDialog'
import { inferListingServiceTypeFromCategorySlug } from '@/lib/partner/listing-service-type'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// Fetch partner bookings with financial data
async function fetchPartnerPayouts() {
  const res = await fetch('/api/v2/partner/payouts', {
    cache: 'no-store',
    credentials: 'include',
  })
  const data = await res.json()
  if (!res.ok) {
    const msg = data?.error || 'Failed to fetch payouts'
    throw new Error(msg)
  }
  return data.data ?? []
}

async function fetchBalanceBreakdown() {
  const res = await fetch('/api/v2/partner/balance-breakdown', {
    cache: 'no-store',
    credentials: 'include',
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json?.error || 'Failed to fetch balance')
  }
  return json.data
}

async function fetchPartnerFinances(partnerId) {
  if (!partnerId) throw new Error('No partner ID')
  
  const res = await fetch(`/api/v2/partner/bookings?partnerId=${partnerId}`, {
    cache: 'no-store',
    credentials: 'include'
  })
  
  const data = await res.json()
  
  if (!res.ok) {
    const msg = data?.error || (res.status === 401 ? 'Auth required' : res.status === 403 ? 'Access denied' : 'Failed to fetch')
    throw new Error(msg)
  }
  
  return data.data ?? []
}

async function fetchFinancesSummary() {
  const res = await fetch('/api/v2/partner/finances-summary', {
    cache: 'no-store',
    credentials: 'include',
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json?.error || 'Failed to fetch finances summary')
  }
  return json.data
}

/** SSOT amounts from API `financial_snapshot` (Stage 45.3). */
function snapshotMoney(booking) {
  const s = booking?.financial_snapshot
  if (s && typeof s === 'object' && Number.isFinite(Number(s.gross))) {
    return {
      gross: Number(s.gross) || 0,
      fee: Number(s.fee) || 0,
      net: Number(s.net) || 0,
    }
  }
  return { gross: 0, fee: 0, net: 0 }
}

// Status badge colors
const PAYOUT_STATUS_LABEL = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  COMPLETED: 'Paid',
  PAID: 'Paid',
  FAILED: 'Failed',
  REJECTED: 'Rejected',
  REFUNDED: 'Refunded',
}

const PAYOUT_STATUS_COLORS = {
  PENDING: 'bg-amber-100 text-amber-900 border-amber-200',
  PROCESSING: 'bg-sky-100 text-sky-900 border-sky-200',
  COMPLETED: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  PAID: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  FAILED: 'bg-red-100 text-red-900 border-red-200',
  REJECTED: 'bg-rose-100 text-rose-900 border-rose-200',
  REFUNDED: 'bg-slate-100 text-slate-800 border-slate-200',
}

const STATUS_COLORS = {
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
  CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-200',
  PAID: 'bg-green-100 text-green-800 border-green-200',
  PAID_ESCROW: 'bg-teal-100 text-teal-800 border-teal-200',
  COMPLETED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  CANCELLED: 'bg-red-100 text-red-800 border-red-200',
  REFUNDED: 'bg-slate-100 text-slate-800 border-slate-200'
}

/** Partner finances: four UX income streams (thaw still maps tour→service bucket — см. паспорт 49.0). */
function partnerFinancesIncomeDisplayKind(categorySlug) {
  const st = inferListingServiceTypeFromCategorySlug(categorySlug || '')
  if (st === 'transport') return 'transport'
  if (st === 'stay') return 'stay'
  if (st === 'tour') return 'tour'
  return 'service'
}

function PartnerBookingIncomeKindBadge({ categorySlug, t }) {
  const kind = partnerFinancesIncomeDisplayKind(
    typeof categorySlug === 'string' ? categorySlug : '',
  )
  const Icon =
    kind === 'stay' ? Home : kind === 'transport' ? Car : kind === 'tour' ? MapPin : Briefcase
  const labelKey =
    kind === 'stay'
      ? 'partnerFinances_incomeTypeStay'
      : kind === 'transport'
        ? 'partnerFinances_incomeTypeTransport'
        : kind === 'tour'
          ? 'partnerFinances_incomeTypeTour'
          : 'partnerFinances_incomeTypeService'
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 shadow-sm shrink-0"
      title={t(labelKey)}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
      <span className="max-w-[4.5rem] truncate sm:max-w-none">{t(labelKey)}</span>
    </span>
  )
}

function StatCard({ icon: Icon, title, value, subtitle, trend, loading }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
        <Icon className="h-4 w-4 text-slate-400" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-8 w-24 bg-slate-200 animate-pulse rounded" />
        ) : (
          <>
            <div className="text-3xl font-bold text-slate-900">{value}</div>
            {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
            {trend && (
              <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
                <TrendingUp className="h-3 w-3" />
                <span>{trend}</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function PartnerFinancesV2Content() {
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
  /** `null` until /api/v2/auth/me — KYC gate for payout (profiles.is_verified). */
  const [partnerProfileVerified, setPartnerProfileVerified] = useState(null)

  // Get partner ID from localStorage
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
              'THB'
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
        const res = await fetch('/api/v2/partner/payout-profiles?default=1', {
          cache: 'no-store',
          credentials: 'include',
        })
        const json = await res.json()
        if (!res.ok || !json?.success) return
        if (!cancelled) {
          setDefaultPayoutProfile(Array.isArray(json.data) ? json.data[0] || null : null)
        }
      } catch {
        if (!cancelled) setDefaultPayoutProfile(null)
      }
    })()
    return () => { cancelled = true }
  }, [partnerId])

  const calcPayoutMath = (baseAmount) => {
    const base = Math.max(0, Number(baseAmount) || 0)
    const method = defaultPayoutProfile?.method
    if (!method) return { fee: 0, final: base }
    const feeType = String(method.fee_type || 'fixed').toLowerCase()
    const feeValue = Math.max(0, Number(method.value) || 0)
    const minPayout = Math.max(0, Number(method.min_payout) || 0)
    if (base < minPayout) return { fee: 0, final: base, minPayoutError: true, minPayout }
    const fee = feeType === 'percentage'
      ? Math.round(base * (feeValue / 100) * 100) / 100
      : Math.round(feeValue * 100) / 100
    const final = Math.max(0, Math.round((base - fee) * 100) / 100)
    return { fee, final, feeType, feeValue }
  }

  useEffect(() => {
    let isMounted = true
    ;(async () => {
      try {
        const [meRes, fxRes] = await Promise.all([
          fetch('/api/v2/auth/me', { cache: 'no-store', credentials: 'include' }),
          fetch('/api/v2/exchange-rates?retail=0', { cache: 'no-store', credentials: 'include' }),
        ])

        if (meRes.ok) {
          const me = await meRes.json()
          const verified =
            me?.user?.is_verified === true ||
            me?.user?.isVerified === true
          if (isMounted) {
            setPartnerProfileVerified(verified)
          }
          const pref =
            String(
              me?.user?.preferredPayoutCurrency ||
                me?.user?.preferred_payout_currency ||
                me?.user?.preferredCurrency ||
                me?.user?.preferred_currency ||
                'THB'
            )
              .toUpperCase()
              .trim() || 'THB'
          if (isMounted) setCurrency(pref)
        } else if (isMounted) {
          setPartnerProfileVerified(false)
        }

        if (fxRes.ok) {
          const fx = await fxRes.json()
          const map = fx?.rateMap && typeof fx.rateMap === 'object' ? fx.rateMap : { THB: 1 }
          if (isMounted) setExchangeRates({ THB: 1, ...map })
        }
      } catch (e) {
        console.warn('[FINANCES] failed to load payout preferences/rates', e)
      }
    })()

    return () => {
      isMounted = false
    }
  }, [])

  // Fetch bookings with TanStack Query
  const { 
    data: bookings = [], 
    isLoading, 
    isError, 
    error,
    refetch
  } = useQuery({
    queryKey: ['partner-finances', partnerId],
    queryFn: () => fetchPartnerFinances(partnerId),
    enabled: !!partnerId,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000 // Auto-refresh every minute
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
    queryFn: fetchFinancesSummary,
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
    queryFn: fetchPartnerPayouts,
    staleTime: 30 * 1000,
  })

  const { data: balanceBreakdown } = useQuery({
    queryKey: ['partner-balance-breakdown', partnerId],
    queryFn: fetchBalanceBreakdown,
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
      const res = await fetch('/api/v2/partner/payouts/request', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId,
          availableThb: financesSummary?.availableThb ?? 0,
          payoutPreviewFinal: pendingPayoutPreview.final,
          payoutFee: pendingPayoutPreview.fee,
          payoutProfileId: defaultPayoutProfile?.id ?? null,
          payoutMethodId:
            defaultPayoutProfile?.method_id ?? defaultPayoutProfile?.method?.id ?? null,
          profileSnapshot: defaultPayoutProfile
            ? {
                methodName: defaultPayoutProfile.method?.name,
                channel: defaultPayoutProfile.method?.channel,
                data: defaultPayoutProfile.data,
              }
            : null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.success === false) {
        if (res.status === 403 && (json?.code === 'PROFILE_NOT_VERIFIED' || json?.error === 'PROFILE_NOT_VERIFIED')) {
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

  // Export to CSV
  const handleExportCSV = () => {
    if (bookings.length === 0) {
      toast.error(t('noTransactionsExport'))
      return
    }

    const csvRows = [
      ['Date', 'Booking ID', t('partnerFinances_csvCategory'), t('listing'), t('guest'), 'Status', t('gross'), t('fee'), t('netEarnings')].join(','),
      ...bookings.map(b => {
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
          net.toFixed(2)
        ].join(',')
      })
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
      const qs = new URLSearchParams({ from: pdfDateFrom, to: pdfDateTo })
      const res = await fetch(`/api/v2/partner/finances-statement-pdf?${qs}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!res.ok) {
        let detail = ''
        try {
          const j = await res.json()
          if (j?.error) detail = String(j.error)
        } catch {
          /* ignore */
        }
        throw new Error(detail || t('partnerFinances_pdfError'))
      }
      const blob = await res.blob()
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

  return (
    <div className="space-y-8 min-w-0 max-w-full">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{t('financesTitle')}</h1>
          <p className="text-slate-600 mt-1 text-sm sm:text-base">{t('financesDesc')}</p>
        </div>
        {balanceBreakdown && (
          <Card className="border-teal-100 bg-teal-50/50 w-full sm:max-w-md">
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="h-4 w-4 text-teal-700" />
                {t('partnerFinances_escrowCardTitle')}
              </CardTitle>
              <CardDescription className="text-xs">
                {t('partnerFinances_escrowCardDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">{t('partnerFinances_escrowFrozenLabel')}</span>
                <span className="font-semibold">{formatPrice(balanceBreakdown.frozenBalanceThb ?? 0, 'THB')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">{t('partnerFinances_escrowAvailableLabel')}</span>
                <span className="font-semibold text-teal-800">{formatPrice(balanceBreakdown.availableBalanceThb ?? 0, 'THB')}</span>
              </div>
              {balanceBreakdown.byCategory && Object.keys(balanceBreakdown.byCategory).length > 0 && (
                <div className="pt-2 border-t border-teal-100 text-xs text-slate-600 space-y-1">
                  <p className="font-medium text-slate-700">{t('partnerFinances_escrowByCategory')}</p>
                  {Object.entries(balanceBreakdown.byCategory).map(([slug, row]) => (
                    <div key={slug} className="flex justify-between gap-2">
                      <span className="truncate">{slug}</span>
                      <span>
                        {t('partnerFinances_escrowFrozenShort')} {formatPrice(row.frozenThb ?? 0, 'THB')} /{' '}
                        {t('partnerFinances_escrowAvailableShort')} {formatPrice(row.availableThb ?? 0, 'THB')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
        <Button 
          onClick={handleExportCSV}
          variant="outline"
          disabled={bookings.length === 0}
          className="gap-2 shrink-0 self-start sm:self-auto"
        >
          <Download className="h-4 w-4" />
          {t('exportCSV')}
        </Button>
      </div>

      <Card className="border-slate-200 bg-slate-50/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('partnerFinances_pdfSectionTitle')}</CardTitle>
          <CardDescription className="text-xs sm:text-sm">{t('partnerFinances_pdfSectionDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1">
              <Label htmlFor="partner-pdf-from" className="text-xs text-slate-600">
                {t('partnerFinances_pdfFrom')}
              </Label>
              <Input
                id="partner-pdf-from"
                type="date"
                value={pdfDateFrom}
                onChange={(e) => setPdfDateFrom(e.target.value)}
                className="w-[11.5rem] bg-white"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="partner-pdf-to" className="text-xs text-slate-600">
                {t('partnerFinances_pdfTo')}
              </Label>
              <Input
                id="partner-pdf-to"
                type="date"
                value={pdfDateTo}
                onChange={(e) => setPdfDateTo(e.target.value)}
                className="w-[11.5rem] bg-white"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => applyPdfMonthPreset('current')}>
                {t('partnerFinances_pdfThisMonth')}
              </Button>
              <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => applyPdfMonthPreset('prev')}>
                {t('partnerFinances_pdfPrevMonth')}
              </Button>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="gap-2 shrink-0 border-teal-200 bg-white hover:bg-teal-50"
              disabled={pdfLoading}
              onClick={handleExportPdf}
            >
              {pdfLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <FileDown className="h-4 w-4" aria-hidden />
              )}
              {pdfLoading ? t('partnerFinances_pdfDownloading') : t('partnerFinances_pdfDownload')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {summaryError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {summaryErr?.message}
          <Button variant="outline" size="sm" className="ml-2" onClick={() => refetchSummary()}>
            {t('retry')}
          </Button>
        </div>
      ) : null}

      {financesSummary?.reconciliation && !financesSummary.reconciliation.withinTolerance ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900">
          {t('partnerFinances_reconciliationWarn')}
          <span className="ml-2 font-mono text-xs">
            Δ {formatPrice(financesSummary.reconciliation.differenceThb ?? 0, 'THB')}
          </span>
        </div>
      ) : financesSummary?.reconciliation?.withinTolerance ? (
        <p className="text-xs text-slate-500">{t('partnerFinances_reconciliationOk')}</p>
      ) : null}

      {/* Financial buckets (server / ledger SSOT) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Calendar}
          title={t('partnerFinances_bucketPendingTitle')}
          value={formatPrice(financesSummary?.pendingThb ?? 0, currency, exchangeRates)}
          subtitle={t('partnerFinances_bucketPendingDesc')}
          loading={summaryLoadingCombined}
        />
        <StatCard
          icon={Shield}
          title={t('partnerFinances_bucketEscrowTitle')}
          value={formatPrice(financesSummary?.escrowThb ?? 0, currency, exchangeRates)}
          subtitle={t('partnerFinances_bucketEscrowDesc')}
          loading={summaryLoadingCombined}
        />
        <StatCard
          icon={Wallet}
          title={t('partnerFinances_bucketAvailableTitle')}
          value={formatPrice(financesSummary?.availableThb ?? 0, currency, exchangeRates)}
          subtitle={t('partnerFinances_bucketAvailableDesc')}
          loading={summaryLoadingCombined}
        />
        <StatCard
          icon={Banknote}
          title={t('partnerFinances_bucketTotalPaidTitle')}
          value={formatPrice(financesSummary?.totalPaidThb ?? 0, currency, exchangeRates)}
          subtitle={t('partnerFinances_bucketTotalPaidDesc')}
          loading={summaryLoadingCombined}
        />
      </div>

      {/* Portfolio roll-up (server SSOT, active bookings) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">{t('partnerFinances_portfolioGrossTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {summaryLoadingCombined ? '—' : formatPrice(financesSummary?.portfolio?.grossThb ?? 0, currency, exchangeRates)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {financesSummary?.portfolio?.bookingCount ?? 0} {t('partnerFinances_portfolioBookingsLabel')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">{t('partnerFinances_portfolioFeeTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">
              {summaryLoadingCombined ? '—' : formatPrice(financesSummary?.portfolio?.feeThb ?? 0, currency, exchangeRates)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">{t('partnerFinances_portfolioNetTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">
              {summaryLoadingCombined ? '—' : formatPrice(financesSummary?.portfolio?.netThb ?? 0, currency, exchangeRates)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ArrowDownToLine className="h-5 w-5 text-slate-600" />
            {t('partnerFinances_payoutHistoryTitle')}
          </CardTitle>
          <CardDescription>{t('partnerFinances_payoutHistoryDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {payoutsLoading ? (
            <div className="h-24 bg-slate-100 animate-pulse rounded-lg" />
          ) : payoutsError ? (
            <div className="text-sm text-red-700">
              {payoutsErr?.message}
              <Button variant="outline" size="sm" className="ml-2" onClick={() => refetchPayouts()}>
                {t('retry')}
              </Button>
            </div>
          ) : payouts.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">{t('partnerFinances_payoutNoRows')}</p>
          ) : (
            <>
              <div className="md:hidden space-y-3 min-w-0">
                {payouts.map((p) => {
                  const cur = p.currency || 'THB'
                  const rates = { THB: 1, ...exchangeRates }
                  const methodName = p.payoutMethod?.name || p.method || '—'
                  const st = String(p.status || '').toUpperCase()
                  const fmtMoney = (amt) => {
                    const n = Number(amt) || 0
                    if (cur === 'THB') return formatPrice(n, 'THB', rates, language)
                    const loc = language === 'ru' ? 'ru-RU' : 'en-US'
                    return `${n.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`
                  }
                  return (
                    <div
                      key={p.id}
                      className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2 text-sm min-w-0"
                    >
                      <div className="flex items-start justify-between gap-2 min-w-0">
                        <span className="text-slate-500 text-xs shrink-0">
                          {p.createdAt ? format(new Date(p.createdAt), 'dd.MM.yyyy HH:mm') : '—'}
                        </span>
                        <Badge className={`text-xs shrink-0 ${PAYOUT_STATUS_COLORS[st] || 'bg-slate-100'}`}>
                          {PAYOUT_STATUS_LABEL[st] || st}
                        </Badge>
                      </div>
                      <p className="font-medium text-slate-800 break-words">{methodName}</p>
                      <div className="grid grid-cols-1 gap-1 text-xs sm:text-sm">
                        <div className="flex justify-between gap-2 min-w-0">
                          <span className="text-slate-500 shrink-0">{t('partnerFinances_colMobileGross')}</span>
                          <span className="tabular-nums text-right break-all">{fmtMoney(p.grossAmount)}</span>
                        </div>
                        <div className="flex justify-between gap-2 min-w-0">
                          <span className="text-slate-500 shrink-0">{t('partnerFinances_colMobileBankFee')}</span>
                          <span className="tabular-nums text-amber-800 text-right break-all">
                            −{fmtMoney(p.payoutFeeAmount)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2 pt-1 border-t border-slate-200 font-semibold min-w-0">
                          <span className="text-slate-700 shrink-0">{t('partnerFinances_colMobileFinal')}</span>
                          <span className="tabular-nums text-emerald-800 text-right break-all">
                            {fmtMoney(p.finalAmount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200 -mx-0">
                <table className="w-full text-sm min-w-[640px]">
                  <thead className="bg-slate-50 text-slate-600 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t('partnerFinances_colDate')}</th>
                      <th className="px-3 py-2 font-medium">{t('partnerFinances_colMethod')}</th>
                      <th className="px-3 py-2 font-medium text-right">{t('partnerFinances_colGross')}</th>
                      <th className="px-3 py-2 font-medium text-right">{t('partnerFinances_colBankFee')}</th>
                      <th className="px-3 py-2 font-medium text-right">{t('partnerFinances_colFinal')}</th>
                      <th className="px-3 py-2 font-medium">{t('partnerFinances_colStatus')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payouts.map((p) => {
                      const cur = p.currency || 'THB'
                      const rates = { THB: 1, ...exchangeRates }
                      const methodName = p.payoutMethod?.name || p.method || '—'
                      const st = String(p.status || '').toUpperCase()
                      const fmtMoney = (amt) => {
                        const n = Number(amt) || 0
                        if (cur === 'THB') return formatPrice(n, 'THB', rates, language)
                        const loc = language === 'ru' ? 'ru-RU' : 'en-US'
                        return `${n.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`
                      }
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/80">
                          <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                            {p.createdAt ? format(new Date(p.createdAt), 'dd.MM.yyyy HH:mm') : '—'}
                          </td>
                          <td className="px-3 py-2 text-slate-800">{methodName}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {fmtMoney(p.grossAmount)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-amber-800">
                            −{fmtMoney(p.payoutFeeAmount)}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums text-emerald-800">
                            {fmtMoney(p.finalAmount)}
                          </td>
                          <td className="px-3 py-2">
                            <Badge className={`text-xs ${PAYOUT_STATUS_COLORS[st] || 'bg-slate-100'}`}>
                              {PAYOUT_STATUS_LABEL[st] || st}
                            </Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-slate-600 shrink-0" />
            {t('partnerFinances_ledgerTitle')}
          </CardTitle>
          <CardDescription>
            {t('partnerFinances_ledgerDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!balanceBreakdown?.recentLedgerTransactions?.length ? (
            <p className="text-sm text-slate-500 py-2">
              {t('partnerFinances_ledgerEmpty')}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 -mx-0">
              <table className="w-full text-sm min-w-[720px]">
                <thead className="bg-slate-50 text-slate-600 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium whitespace-nowrap">
                      {t('partnerFinances_ledgerColDate')}
                    </th>
                    <th className="px-3 py-2 font-medium">{t('partnerFinances_ledgerColEvent')}</th>
                    <th className="px-3 py-2 font-medium">{t('partnerFinances_ledgerColSide')}</th>
                    <th className="px-3 py-2 font-medium text-right">{t('partnerFinances_ledgerColThb')}</th>
                    <th className="px-3 py-2 font-medium">{t('partnerFinances_ledgerColBooking')}</th>
                    <th className="px-3 py-2 font-medium">{t('partnerFinances_ledgerColNote')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {balanceBreakdown.recentLedgerTransactions.map((row) => (
                    <tr key={row.entryId || `${row.journalId}-${row.createdAt}`} className="hover:bg-slate-50/80">
                      <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                        {row.createdAt ? format(new Date(row.createdAt), 'dd.MM.yyyy HH:mm') : '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-800 font-mono text-xs">
                        {row.eventType || '—'}
                      </td>
                      <td className="px-3 py-2">{row.side || '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {formatPrice(row.amountThb ?? 0, 'THB')}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {row.bookingId ? (
                          <Link
                            href={`/partner/bookings?booking=${encodeURIComponent(String(row.bookingId))}`}
                            className="text-teal-700 hover:underline"
                            title={row.bookingId}
                          >
                            {String(row.bookingId).slice(0, 8)}…
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-600 max-w-[240px] truncate" title={row.description || ''}>
                        {row.description || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-indigo-200 bg-indigo-50/50 min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg">{t('partnerFinances_payoutMathTitle')}</CardTitle>
          <CardDescription>
            {defaultPayoutProfile?.method?.name
              ? `${t('partnerFinances_payoutMathDefaultMethod')}: ${defaultPayoutProfile.method.name}`
              : t('partnerFinances_payoutMathDescNoProfile')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm min-w-0 overflow-x-auto">
          <div className="flex justify-between gap-3 min-w-0">
            <span className="text-slate-600 shrink-0">{t('partnerFinances_payoutMathBaseAvailable')}</span>
            <span className="font-medium tabular-nums text-right break-all min-w-0">
              {formatPrice(financesSummary?.availableThb ?? 0, currency, exchangeRates)}
            </span>
          </div>
          <div className="flex justify-between gap-3 min-w-0">
            <span className="text-slate-600 shrink-0">{t('partnerFinances_payoutMathFee')}</span>
            <span className="font-medium tabular-nums text-right break-all min-w-0">
              -{formatPrice(pendingPayoutPreview.fee, currency, exchangeRates)}
            </span>
          </div>
          <div className="flex justify-between gap-3 pt-2 border-t border-indigo-200 text-base font-semibold min-w-0">
            <span className="shrink-0">{t('partnerFinances_payoutMathFinal')}</span>
            <span className="text-indigo-700 tabular-nums text-right break-all min-w-0">
              {formatPrice(pendingPayoutPreview.final, currency, exchangeRates)}
            </span>
          </div>
          {partnerProfileVerified === false ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
              <p>{t('partnerFinances_payoutKycBlockedHint')}</p>
              <Button variant="link" className="h-auto p-0 mt-1 text-amber-900 underline" asChild>
                <Link href="/partner/settings">{t('partnerFinances_payoutKycLinkSettings')}</Link>
              </Button>
            </div>
          ) : null}
          <div className="pt-4">
            <Button
              type="button"
              className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 sm:w-auto"
              onClick={() => setWithdrawOpen(true)}
              disabled={
                summaryLoading ||
                !partnerId ||
                partnerProfileVerified !== true
              }
            >
              <ArrowDownToLine className="h-4 w-4 shrink-0" aria-hidden />
              {t('partnerFinances_withdrawCta')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card ref={transactionSectionRef}>
        <CardHeader>
          <CardTitle>{t('transactionHistory')}</CardTitle>
          <CardDescription>{t('transactionHistoryDesc')}</CardDescription>
          {escrowBookingFilter ? (
            <div className="mt-3 flex flex-col gap-2 rounded-lg border border-teal-200 bg-teal-50/80 px-3 py-2 text-sm text-teal-950 sm:flex-row sm:items-center sm:justify-between">
              <span>{t('partnerFinances_escrowFilterBanner')}</span>
              <Link
                href="/partner/finances"
                className="shrink-0 font-semibold text-teal-800 underline underline-offset-2 hover:text-teal-900"
              >
                {t('partnerFinances_escrowFilterShowAll')}
              </Link>
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 bg-slate-100 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : isError ? (
            <div className="text-center py-8">
              <p className="mb-2 text-slate-700 font-medium">{t('failedToLoad')}</p>
              <p className="text-sm text-slate-500 mb-4">{error?.message}</p>
              <Button onClick={() => refetch()} variant="outline">
                {t('retry')}
              </Button>
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Calendar className="h-16 w-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">{t('noTransactions')}</h3>
              <p>{t('noTransactionsDesc')}</p>
            </div>
          ) : displayedBookings.length === 0 ? (
            <div className="text-center py-10 text-slate-600">
              <p className="font-medium text-slate-800 mb-2">{t('partnerFinances_noEscrowTitle')}</p>
              <p className="text-sm text-slate-500 mb-4">
                {t('partnerFinances_noEscrowRows')}
              </p>
              <Button variant="outline" asChild>
                <Link href="/partner/finances">{t('partnerFinances_escrowFilterShowAll')}</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {displayedBookings.map((booking) => {
                const { gross, fee, net } = snapshotMoney(booking)
                const payoutMath = calcPayoutMath(net)
                const checkIn = booking.checkIn || booking.check_in
                const checkOut = booking.checkOut || booking.check_out
                
                return (
                  <div 
                    key={booking.id} 
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors gap-4"
                  >
                    {/* Left: Booking Info */}
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h4 className="font-semibold text-slate-900">
                          {booking.listing?.title || t('listing')}
                        </h4>
                        <PartnerBookingIncomeKindBadge
                          categorySlug={booking.financial_snapshot?.category_slug}
                          t={t}
                        />
                        <Badge className={`text-xs ${STATUS_COLORS[booking.status] || 'bg-slate-100'}`}>
                          {booking.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600">
                        {t('guest')}: {booking.guestName || booking.guest_name || 'N/A'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {checkIn && format(new Date(checkIn), 'MMM d')} → {checkOut && format(new Date(checkOut), 'MMM d, yyyy')}
                      </p>
                    </div>

                    {/* Right: Financial Breakdown */}
                    <div className="flex flex-col md:items-end gap-1">
                      <div className="flex items-center gap-4 text-sm">
                        <div>
                          <span className="text-slate-500">{t('gross')}:</span>
                          <span className="font-medium text-slate-900 ml-2">
                            {formatPrice(gross, currency, exchangeRates)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">{t('fee')}:</span>
                          <span className="font-medium text-red-600 ml-2">
                            -{formatPrice(fee, currency, exchangeRates)}
                          </span>
                        </div>
                      </div>
                      <div className="text-lg font-bold text-green-600">
                        {formatPrice(net, currency, exchangeRates)}
                      </div>
                      <p className="text-xs text-slate-500">{t('yourNetEarnings')}</p>
                      <p className="text-xs text-indigo-700">
                        {t('partnerFinances_payoutLine')}: {formatPrice(net, currency, exchangeRates)} −{' '}
                        {formatPrice(payoutMath.fee, currency, exchangeRates)} ={' '}
                        {formatPrice(payoutMath.final, currency, exchangeRates)}
                      </p>
                      {booking.financial_snapshot ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2 gap-1.5 border-teal-200 text-teal-900 hover:bg-teal-50"
                          onClick={() => setFinanceFocusBooking(booking)}
                        >
                          <Receipt className="h-4 w-4 shrink-0" aria-hidden />
                          {t('partnerFinances_rowOpenDetails')}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Footer — no commission numbers */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 mb-1">{t('howPayoutsWork')}</h4>
              <p className="text-sm text-blue-700">
                {t('payoutsInfo')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('partnerFinances_withdrawDialogTitle')}</DialogTitle>
            <DialogDescription>{t('partnerFinances_withdrawDialogDesc')}</DialogDescription>
          </DialogHeader>
          {partnerProfileVerified === false ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {t('partnerFinances_payoutKycBlockedHint')}
              <div className="mt-2">
                <Link
                  href="/partner/settings"
                  className="font-semibold text-amber-900 underline underline-offset-2"
                >
                  {t('partnerFinances_payoutKycLinkSettings')}
                </Link>
              </div>
            </div>
          ) : null}
          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-2 border-b border-slate-200 pb-2">
              <span className="text-slate-600">{t('partnerFinances_withdrawAvailableLabel')}</span>
              <span className="font-semibold tabular-nums">
                {formatPrice(financesSummary?.availableThb ?? 0, currency, exchangeRates)}
              </span>
            </div>
            <div className="flex justify-between gap-2 border-b border-slate-200 pb-2">
              <span className="text-slate-600">{t('partnerFinances_withdrawEstimatedLabel')}</span>
              <span className="font-semibold tabular-nums text-indigo-700">
                {formatPrice(pendingPayoutPreview.final, currency, exchangeRates)}
              </span>
            </div>
            <div>
              <p className="font-medium text-slate-800">{t('partnerFinances_withdrawRequisites')}</p>
              {defaultPayoutProfile ? (
                <div className="mt-1 space-y-1 rounded-md bg-slate-50 p-2 text-xs text-slate-700">
                  <p>
                    <span className="text-slate-500">{t('partnerFinances_colMethod')}: </span>
                    {defaultPayoutProfile.method?.name || '—'}
                  </p>
                  <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all font-mono">
                    {JSON.stringify(defaultPayoutProfile.data ?? {}, null, 2)}
                  </pre>
                </div>
              ) : (
                <p className="mt-1 text-amber-800">{t('partnerFinances_withdrawNoProfile')}</p>
              )}
            </div>
            {!defaultPayoutProfile ? (
              <Button variant="outline" asChild className="w-full">
                <Link href="/partner/payout-profiles">{t('partnerFinances_withdrawLinkProfiles')}</Link>
              </Button>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setWithdrawOpen(false)}>
              {t('partnerFinances_withdrawCancel')}
            </Button>
            <Button
              type="button"
              className="gap-2"
              onClick={() => void handleWithdrawSubmit()}
              disabled={
                withdrawSubmitting ||
                !partnerId ||
                partnerProfileVerified !== true
              }
            >
              {withdrawSubmitting ? <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden /> : null}
              {t('partnerFinances_withdrawConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PartnerFinancialSnapshotDialog
        open={!!financeFocusBooking}
        onOpenChange={(open) => {
          if (!open) setFinanceFocusBooking(null)
        }}
        snapshot={financeFocusBooking?.financial_snapshot}
        bookingTitle={financeFocusBooking?.listing?.title || t('listing')}
        bookingId={String(financeFocusBooking?.id || '')}
        status={financeFocusBooking?.status}
        language={language}
      />
    </div>
  )
}

export default function PartnerFinancesV2() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-teal-600" aria-label="Загрузка" />
        </div>
      }
    >
      <PartnerFinancesV2Content />
    </Suspense>
  )
}
