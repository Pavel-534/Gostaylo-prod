'use client'

import { format, parseISO } from 'date-fns'
import { ru, enUS, zhCN, th as thLocale } from 'date-fns/locale'
import { Bell, CalendarDays, Check, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PartnerHostLedgerAmount } from '@/components/partner/finances/partner-host-amount-display'
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

function occupancyRingStrokeClass(rate) {
  if (rate >= 80) return 'stroke-brand'
  if (rate >= 50) return 'stroke-amber-500'
  return 'stroke-red-500'
}

function occupancyPercentTextClass(size) {
  if (size < 96) return 'text-lg font-bold text-slate-900 tabular-nums leading-none'
  return 'text-2xl font-bold text-slate-900 tabular-nums leading-none'
}

/** Radial occupancy ring — Stage 187.0: i18n label, token strokes, compact mode when size &lt; 96. */
export function OccupancyRadial({ rate, size = 120, language = 'ru' }) {
  const strokeWidth = size < 96 ? 8 : 10
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (rate / 100) * circumference
  const showLabel = size >= 96
  const label = getUIText('partnerDashboard_occupancyRadialLabel', language)

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 transform" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-slate-200"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={cn('transition-all duration-700 ease-out', occupancyRingStrokeClass(rate))}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-1">
        <span className={occupancyPercentTextClass(size)}>{rate}%</span>
        {showLabel ? (
          <span className="text-[10px] leading-tight text-slate-500 text-center max-w-[90%] truncate">
            {label}
          </span>
        ) : null}
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
      <p className="text-brand-hover tabular-nums">
        <PartnerHostLedgerAmount thb={row.amountThb} />
      </p>
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

/** Tap-to-open pending row — no inline approve/decline (Stage 187.0). */
export function PendingBookingCard({ booking, onOpen, language = 'ru' }) {
  const dateLocale = DASH_DATE_LOCALE[language] || ru
  const amountThb = partnerListAmountThb(booking)
  return (
    <button
      type="button"
      onClick={() => onOpen?.(booking.id)}
      className={cn(
        'flex w-full min-h-[44px] items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left',
        'transition-colors hover:bg-amber-100/80 active:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
      )}
      aria-label={getUIText('partnerBookings_openDetails', language)}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-slate-900">{booking.guestName}</p>
        <p className="truncate text-xs text-slate-500">{booking.listingTitle}</p>
        <p
          className="mt-0.5 text-xs text-amber-700 tabular-nums"
          title={getUIText('partnerDashboard_amountNetTooltip', language)}
        >
          {booking.checkIn && format(parseISO(booking.checkIn), 'd MMM', { locale: dateLocale })} •{' '}
          <PartnerHostLedgerAmount thb={amountThb} />
        </p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-amber-700" aria-hidden />
    </button>
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
