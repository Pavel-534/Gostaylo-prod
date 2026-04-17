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

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  DollarSign, TrendingUp, Wallet, Download, 
  Calendar, Building2, Clock, ArrowDownToLine
} from 'lucide-react'
import { formatPrice } from '@/lib/currency'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { getUIText } from '@/lib/translations'
import { useI18n } from '@/contexts/i18n-context'

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

// Fetch effective commission rate from admin settings (profiles.custom_commission_rate or system_settings)
async function fetchCommissionRate(partnerId) {
  if (!partnerId) return { effectiveRate: 15, partnerEarningsPercent: 85 }
  try {
    const res = await fetch(`/api/v2/commission?partnerId=${partnerId}`, { cache: 'no-store' })
    const json = await res.json()
    if (json?.data) {
      return { effectiveRate: json.data.effectiveRate ?? 15, partnerEarningsPercent: json.data.partnerEarningsPercent ?? 85 }
    }
  } catch { /* ignore */ }
  return { effectiveRate: 15, partnerEarningsPercent: 85 }
}

// Financial calculations — uses per-booking commission_rate when available
const DEFAULT_COMMISSION_RATE = 15

function calculateFinances(bookings) {
  let totalGrossRevenue = 0
  let totalGoStayLoFee = 0
  let totalNetEarnings = 0
  let pendingRevenue = 0
  let completedRevenue = 0
  
  bookings.forEach(booking => {
    const gross = parseFloat(booking.priceThb || booking.total_price_thb) || 0
    const rate = parseFloat(booking.commissionRate ?? booking.listing?.commissionRate) || DEFAULT_COMMISSION_RATE
    const feeRate = rate / 100
    const fee = gross * feeRate
    const net = parseFloat(booking.partnerEarningsThb) || (gross - fee)
    
    totalGrossRevenue += gross
    totalGoStayLoFee += fee
    totalNetEarnings += net
    
    if (booking.status === 'COMPLETED') {
      completedRevenue += net
    } else if (['CONFIRMED', 'PAID', 'PAID_ESCROW'].includes(booking.status)) {
      pendingRevenue += net
    }
  })
  
  const avgFeePercent = totalGrossRevenue > 0 
    ? Math.round((totalGoStayLoFee / totalGrossRevenue) * 100) 
    : DEFAULT_COMMISSION_RATE
  const netPercent = 100 - avgFeePercent
  
  return {
    totalGrossRevenue,
    totalGoStayLoFee,
    totalNetEarnings,
    completedRevenue,
    pendingRevenue,
    transactionCount: bookings.length,
    avgFeePercent,
    netPercent
  }
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

export default function PartnerFinancesV2() {
  const { language } = useI18n()
  const t = (key) => getUIText(key, language)
  
  const [partnerId, setPartnerId] = useState(null)
  const [currency, setCurrency] = useState('THB')
  const [exchangeRates, setExchangeRates] = useState({ THB: 1 })
  const [defaultPayoutProfile, setDefaultPayoutProfile] = useState(null)

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

  // Fetch effective commission rate (from admin: 7% global, 4% per-user)
  const { data: commissionData } = useQuery({
    queryKey: ['partner-commission', partnerId],
    queryFn: () => fetchCommissionRate(partnerId),
    enabled: !!partnerId
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

  // Calculate financial stats
  const finances = calculateFinances(bookings)
  
  // When no bookings: use effective rate from admin settings. When bookings exist: use calculated avg
  const displayFeePercent = finances.transactionCount > 0 ? finances.avgFeePercent : (commissionData?.effectiveRate ?? DEFAULT_COMMISSION_RATE)
  const displayNetPercent = finances.transactionCount > 0 ? finances.netPercent : (commissionData?.partnerEarningsPercent ?? (100 - DEFAULT_COMMISSION_RATE))
  const pendingPayoutPreview = calcPayoutMath(finances.pendingRevenue)

  // Export to CSV
  const handleExportCSV = () => {
    if (bookings.length === 0) {
      toast.error(t('noTransactionsExport'))
      return
    }

    const csvRows = [
      ['Date', 'Booking ID', t('listing'), t('guest'), 'Status', t('gross'), t('fee'), t('netEarnings')].join(','),
      ...bookings.map(b => {
        const gross = parseFloat(b.priceThb || b.total_price_thb) || 0
        const rate = parseFloat(b.commissionRate ?? b.listing?.commissionRate) || DEFAULT_COMMISSION_RATE
        const fee = gross * (rate / 100)
        const net = parseFloat(b.partnerEarningsThb) || (gross - fee)
        return [
          format(new Date(b.createdAt || b.created_at), 'yyyy-MM-dd'),
          b.id,
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

  return (
    <div className="space-y-8 min-w-0 max-w-full">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{t('financesTitle')}</h1>
          <p className="text-slate-600 mt-1 text-sm sm:text-base">{t('financesDesc')}</p>
        </div>
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

      {/* Financial Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={DollarSign}
          title={t('totalGrossRevenue')}
          value={formatPrice(finances.totalGrossRevenue, currency, exchangeRates)}
          subtitle={t('beforeFees')}
          loading={isLoading}
        />
        
        <StatCard
          icon={Building2}
          title={`${t('platformFee')} (${displayFeePercent}%)`}
          value={formatPrice(finances.totalGoStayLoFee, currency, exchangeRates)}
          subtitle={t('platformFee')}
          loading={isLoading}
        />
        
        <StatCard
          icon={Wallet}
          title={`${t('netEarnings')} (${displayNetPercent}%)`}
          value={formatPrice(finances.totalNetEarnings, currency, exchangeRates)}
          subtitle={t('yourShare')}
          loading={isLoading}
        />
        
        <StatCard
          icon={TrendingUp}
          title={t('transactions')}
          value={finances.transactionCount}
          subtitle={`${bookings.filter(b => b.status === 'COMPLETED').length} ${t('completed')}`}
          loading={isLoading}
        />
      </div>

      {/* Revenue Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              {t('completedRevenue')}
            </CardTitle>
            <CardDescription>{t('fundsFromCompleted')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {formatPrice(finances.completedRevenue, currency, exchangeRates)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              {t('pendingRevenue')}
            </CardTitle>
            <CardDescription>{t('upcomingBookings')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">
              {formatPrice(finances.pendingRevenue, currency, exchangeRates)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ArrowDownToLine className="h-5 w-5 text-slate-600" />
            История выплат
          </CardTitle>
          <CardDescription>Дата, метод, суммы и статус вывода средств</CardDescription>
        </CardHeader>
        <CardContent>
          {payoutsLoading ? (
            <div className="h-24 bg-slate-100 animate-pulse rounded-lg" />
          ) : payoutsError ? (
            <div className="text-sm text-red-700">
              {payoutsErr?.message}
              <Button variant="outline" size="sm" className="ml-2" onClick={() => refetchPayouts()}>
                Повторить
              </Button>
            </div>
          ) : payouts.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">Пока нет заявок на выплату.</p>
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
                          <span className="text-slate-500 shrink-0">Gross</span>
                          <span className="tabular-nums text-right break-all">{fmtMoney(p.grossAmount)}</span>
                        </div>
                        <div className="flex justify-between gap-2 min-w-0">
                          <span className="text-slate-500 shrink-0">Комиссия</span>
                          <span className="tabular-nums text-amber-800 text-right break-all">
                            −{fmtMoney(p.payoutFeeAmount)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2 pt-1 border-t border-slate-200 font-semibold min-w-0">
                          <span className="text-slate-700 shrink-0">Итого</span>
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
                      <th className="px-3 py-2 font-medium">Дата</th>
                      <th className="px-3 py-2 font-medium">Метод</th>
                      <th className="px-3 py-2 font-medium text-right">Gross</th>
                      <th className="px-3 py-2 font-medium text-right">Комиссия банка</th>
                      <th className="px-3 py-2 font-medium text-right">Итого к получению</th>
                      <th className="px-3 py-2 font-medium">Статус</th>
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

      <Card className="border-indigo-200 bg-indigo-50/50 min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg">Payout Math</CardTitle>
          <CardDescription>
            {defaultPayoutProfile?.method?.name
              ? `Default method: ${defaultPayoutProfile.method.name}`
              : 'Добавьте payout-профиль в разделе «Реквизиты для выплат», чтобы видеть банковскую комиссию заранее.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm min-w-0 overflow-x-auto">
          <div className="flex justify-between gap-3 min-w-0">
            <span className="text-slate-600 shrink-0">BasePayout (pending)</span>
            <span className="font-medium tabular-nums text-right break-all min-w-0">
              {formatPrice(finances.pendingRevenue, currency, exchangeRates)}
            </span>
          </div>
          <div className="flex justify-between gap-3 min-w-0">
            <span className="text-slate-600 shrink-0">Payout Fee</span>
            <span className="font-medium tabular-nums text-right break-all min-w-0">
              -{formatPrice(pendingPayoutPreview.fee, currency, exchangeRates)}
            </span>
          </div>
          <div className="flex justify-between gap-3 pt-2 border-t border-indigo-200 text-base font-semibold min-w-0">
            <span className="shrink-0">FinalAmount</span>
            <span className="text-indigo-700 tabular-nums text-right break-all min-w-0">
              {formatPrice(pendingPayoutPreview.final, currency, exchangeRates)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>{t('transactionHistory')}</CardTitle>
          <CardDescription>{t('transactionHistoryDesc')}</CardDescription>
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
          ) : (
            <div className="space-y-4">
              {bookings.map((booking) => {
                const gross = parseFloat(booking.priceThb || booking.total_price_thb) || 0
                const rate = parseFloat(booking.commissionRate ?? booking.listing?.commissionRate) || DEFAULT_COMMISSION_RATE
                const fee = gross * (rate / 100)
                const net = parseFloat(booking.partnerEarningsThb) || (gross - fee)
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
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-slate-900">
                          {booking.listing?.title || t('listing')}
                        </h4>
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
                        Payout: {formatPrice(net, currency, exchangeRates)} - {formatPrice(payoutMath.fee, currency, exchangeRates)} = {formatPrice(payoutMath.final, currency, exchangeRates)}
                      </p>
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
    </div>
  )
}
