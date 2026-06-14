/**
 * CalendarHeader Component
 * Navigation, controls, and legend for Partner Calendar
 * Stage 140.4 — iCal legend + force-sync all partner listings
 */

'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ru, enUS, zhCN, th as thLocale } from 'date-fns/locale'
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  DollarSign,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Info,
  CalendarSync,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getUIText } from '@/lib/translations'

const DATE_FNS_LOCALE = { ru, en: enUS, zh: zhCN, th: thLocale }

function trTpl(template, vars) {
  let s = String(template || '')
  for (const [k, v] of Object.entries(vars || {})) {
    s = s.split(`{{${k}}}`).join(String(v))
  }
  return s
}

function LegendBody({ variant = 'inline', language = 'ru' }) {
  const t = (key) => getUIText(key, language)
  const wrap = variant === 'stacked' ? 'flex flex-col gap-2.5' : 'flex items-center gap-4 flex-wrap'
  return (
    <div className={`${wrap} text-xs`}>
      <div className="flex items-center gap-1.5">
        <div className="h-3 w-3 shrink-0 rounded bg-brand" />
        <span className="text-slate-600">{t('partnerCal_legendConfirmed')}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-3 w-3 shrink-0 rounded bg-amber-400" />
        <span className="text-slate-600">{t('partnerCal_legendPending')}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-3 w-3 shrink-0 rounded bg-slate-300" />
        <span className="text-slate-600">{t('partnerCal_legendManualBlock')}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-3 w-3 shrink-0 rounded border border-dashed border-brand/50 bg-brand/15" />
        <span className="text-slate-600">{t('partnerCal_legendIcalBlock')}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-3 w-3 shrink-0 rounded bg-slate-200" />
        <span className="text-slate-600">{t('partnerCal_legendInventoryBlock')}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-3 w-3 shrink-0 rounded border-2 border-dashed border-brand/40" />
        <span className="text-slate-600">{t('partnerCal_legendCheckInOut')}</span>
      </div>
      <div className="hidden h-4 w-px bg-slate-300 sm:block" aria-hidden />
      <div className="flex items-center gap-1.5">
        <span className="font-bold text-brand">฿</span>
        <span className="text-slate-600">{t('partnerCal_legendHighSeason')}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-slate-400">฿</span>
        <span className="text-slate-600">{t('partnerCal_legendLowSeason')}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-slate-500">฿</span>
        <span className="text-slate-600">{t('partnerCal_legendBasePrice')}</span>
      </div>
    </div>
  )
}

export function CalendarHeader({
  startDate,
  endDate,
  viewMode,
  summary,
  language = 'ru',
  onToday,
  onBack,
  onForward,
  onViewModeChange,
  onRefresh,
  onIcalSyncAll,
  icalSyncing = false,
  onPriceModalOpen,
}) {
  const [legendOpen, setLegendOpen] = useState(false)
  const t = (key) => getUIText(key, language)
  const dfLocale = DATE_FNS_LOCALE[language] || ru

  return (
    <>
      <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <CalendarDays className="h-6 w-6 text-brand" />
            {t('partnerCal_headerTitle')}
          </h1>
          <p className="mt-1 text-slate-600">
            {trTpl(t('partnerCal_headerSubtitle'), {
              listings: summary?.totalListings || 0,
              bookings: summary?.totalBookings || 0,
            })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onIcalSyncAll ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onIcalSyncAll}
              disabled={icalSyncing}
              className="border-brand/30 text-brand hover:bg-brand/10"
              title={t('partnerCal_syncAllIcalTitle')}
            >
              {icalSyncing ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <CalendarSync className="mr-1 h-4 w-4" />
              )}
              <span className="hidden sm:inline">{t('partnerCal_syncAllIcal')}</span>
            </Button>
          ) : null}

          <Button
            variant="outline"
            size="sm"
            onClick={onPriceModalOpen}
            className="border-0 bg-brand text-white hover:bg-brand-hover"
          >
            <DollarSign className="mr-1 h-4 w-4" />
            {t('partnerCal_setPrices')}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onToday}
            className="border-brand/25 text-brand hover:bg-brand/10"
          >
            {t('partnerCal_today')}
          </Button>

          <div className="flex items-center overflow-hidden rounded-lg border">
            <Button variant="ghost" size="sm" onClick={onBack} className="rounded-none">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[140px] px-3 text-center text-sm font-medium text-slate-700">
              {format(parseISO(startDate), 'd MMM', { locale: dfLocale })} —{' '}
              {format(parseISO(endDate), 'd MMM yyyy', { locale: dfLocale })}
            </span>
            <Button variant="ghost" size="sm" onClick={onForward} className="rounded-none">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="hidden items-center gap-1 overflow-hidden rounded-lg border md:flex">
            <Button
              variant={viewMode === 'compact' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('compact')}
              className="rounded-none"
              title={t('partnerCal_compactView')}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'wide' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('wide')}
              className="rounded-none"
              title={t('partnerCal_wideView')}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          <Button variant="ghost" size="sm" onClick={onRefresh} title={t('partnerCal_refresh')}>
            <RefreshCw className="h-4 w-4" />
          </Button>

          <div className="sm:hidden">
            <Popover open={legendOpen} onOpenChange={setLegendOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0 border-slate-200"
                  title={t('partnerCal_legendTitle')}
                >
                  <Info className="h-4 w-4 text-slate-600" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[min(calc(100vw-1.5rem),20rem)] p-3 sm:p-4">
                <p className="mb-2 text-xs font-semibold text-slate-800">{t('partnerCal_legendTitle')}</p>
                <LegendBody variant="stacked" language={language} />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <div className="mb-4 hidden sm:block">
        <LegendBody language={language} />
      </div>
    </>
  )
}
