'use client'

import { format, parseISO } from 'date-fns'
import { ru, enUS, zhCN, th as thLocale } from 'date-fns/locale'
import { Bell, CalendarDays, Check, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { getUIText } from '@/lib/translations'
import { getSiteDisplayName } from '@/lib/site-url'
import { BRAND_CHART_HEX } from '@/lib/theme/product-ui'

export function WelcomePartnerModal({ isOpen, onClose, onStartListing, userName, language = 'ru' }) {
  if (!isOpen) return null
  const brand = getSiteDisplayName()
  const t = (key) => getUIText(key, language, { brand })
  const handleStart = () => {
    onClose?.()
    onStartListing?.()
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-gradient-to-br from-brand/90 via-brand to-emerald-700 rounded-2xl max-w-md w-full p-8 text-white text-center relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-0 opacity-20">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-white rounded-full animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${1 + Math.random() * 2}s`,
              }}
            />
          ))}
        </div>
        <div className="relative z-10">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bell className="h-10 w-10" />
          </div>
          <h2 className="text-3xl font-bold mb-2">{t('welcomePartnerTitle')}</h2>
          <p className="text-lg mb-4">{userName || 'Partner'}</p>
          <div className="bg-white/20 rounded-lg p-4 mb-6">
            <CalendarDays className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">{t('welcomePartnerBody')}</p>
          </div>
          <Button onClick={handleStart} className="w-full bg-white text-brand hover:bg-white/90">
            {t('welcomePartnerButton')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function DashboardSkeleton({ className }) {
  return (
    <div
      className={cn(
        'animate-pulse bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%] rounded',
        className,
      )}
    />
  )
}

export function RevenueSparkline({ data, color = BRAND_CHART_HEX, height = 40 }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data.map((d) => d.revenue), 1)
  const width = 120
  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * width
      const y = height - (d.revenue / max) * (height - 4)
      return `${x},${y}`
    })
    .join(' ')
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id="sparklineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      <polygon fill="url(#sparklineGradient)" points={`0,${height} ${points} ${width},${height}`} />
    </svg>
  )
}

export function OccupancyRadial({ rate, size = 120 }) {
  const strokeWidth = 10
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (rate / 100) * circumference
  const getColor = (r) => {
    if (r >= 80) return '#0d9488'
    if (r >= 50) return '#f59e0b'
    return '#ef4444'
  }
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor(rate)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-slate-900">{rate}%</span>
        <span className="text-xs text-slate-500">загрузка</span>
      </div>
    </div>
  )
}

export function IncomeChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-slate-700">{row.label}</p>
      <p className="text-brand-hover tabular-nums">{formatPrice(row.amountThb, 'THB')}</p>
    </div>
  )
}

export const DASH_DATE_LOCALE = { ru, en: enUS, zh: zhCN, th: thLocale }

export function partnerListAmountThb(booking) {
  const net = Number(booking?.partnerNetThb)
  if (Number.isFinite(net)) return net
  const gross = Number(booking?.priceThb)
  return Number.isFinite(gross) ? gross : 0
}

export function PendingBookingCard({ booking, onApprove, onDecline, isLoading, language = 'ru' }) {
  const dateLocale = DASH_DATE_LOCALE[language] || ru
  const amountThb = partnerListAmountThb(booking)
  return (
    <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 truncate">{booking.guestName}</p>
        <p className="text-xs text-slate-500 truncate">{booking.listingTitle}</p>
        <p
          className="text-xs text-amber-600 mt-0.5"
          title={getUIText('partnerDashboard_amountNetTooltip', language)}
        >
          {booking.checkIn && format(parseISO(booking.checkIn), 'd MMM', { locale: dateLocale })} •{' '}
          {formatPrice(amountThb, 'THB')}
        </p>
      </div>
      <div className="flex gap-1.5 ml-2">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-green-600 hover:bg-green-100"
          onClick={() => onApprove(booking.id)}
          disabled={isLoading}
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-red-600 hover:bg-red-100"
          onClick={() => onDecline(booking.id)}
          disabled={isLoading}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export function PartnerDashboardLoadingSkeleton() {
  return (
    <div className="space-y-6 gsl-shimmer" aria-busy>
      <div className="flex justify-between items-center">
        <DashboardSkeleton className="h-8 w-48" />
        <DashboardSkeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg border-0 shadow-sm p-4">
            <DashboardSkeleton className="h-4 w-20 mb-2" />
            <DashboardSkeleton className="h-8 w-28 mb-2" />
            <DashboardSkeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Shown when cookie session exists but auth user id is not hydrated yet. */
export function PartnerDashboardIdentityGate({ language = 'ru', onRetry }) {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-4 text-center"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-10 w-10 animate-spin text-brand" aria-hidden />
      <p className="text-sm text-slate-600 max-w-xs">{getUIText('partnerDashboard_sessionSync', language)}</p>
      <Button type="button" variant="outline" size="sm" onClick={() => onRetry?.()}>
        {getUIText('partnerDashboard_retry', language)}
      </Button>
    </div>
  )
}
