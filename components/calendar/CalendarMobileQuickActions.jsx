/**
 * Stage 194.0-B / 200.40 / 200.41 — Mobile calendar quick strip.
 * Primary: Block · iCal.
 * Modes: Near-term · Month grid · 3-month overview (heatmap).
 * Options sheet: prices · iCal sync.
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Lock,
  CalendarSync,
  MoreHorizontal,
  DollarSign,
  Loader2,
  CalendarRange,
  CalendarDays,
  LayoutGrid,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'

/**
 * @param {{
 *   language?: string
 *   icalHref: string
 *   mobilePane: 'near' | 'month' | 'overview'
 *   onMobilePaneChange: (pane: 'near' | 'month' | 'overview') => void
 *   onQuickBlock: () => void
 *   onOpenPrices: () => void
 *   onIcalSyncAll?: () => void
 *   icalSyncing?: boolean
 *   className?: string
 * }} props
 */
export function CalendarMobileQuickActions({
  language = 'ru',
  icalHref,
  mobilePane = 'near',
  onMobilePaneChange,
  onQuickBlock,
  onOpenPrices,
  onIcalSyncAll,
  icalSyncing = false,
  className,
}) {
  const t = (key) => getUIText(key, language)
  const [optionsOpen, setOptionsOpen] = useState(false)

  const modeBtn = (active) =>
    cn(
      'flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-semibold leading-tight transition-colors sm:text-[11px]',
      active ? 'bg-brand text-white' : 'bg-white text-slate-600 hover:bg-slate-50',
    )

  return (
    <>
      <div
        className={cn(
          'space-y-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm',
          className,
        )}
        data-testid="partner-cal-mobile-quick-actions"
      >
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="brand"
            className="min-h-11 w-full flex-col gap-0.5 py-2 sm:flex-row sm:gap-1.5"
            onClick={onQuickBlock}
            data-testid="partner-cal-quick-block"
          >
            <Lock className="h-4 w-4 shrink-0" aria-hidden />
            <span className="max-w-full whitespace-normal text-center text-xs font-semibold leading-tight sm:text-sm">
              {t('partnerCal_quickBlock')}
            </span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full flex-col gap-0.5 border-brand/30 py-2 text-brand hover:bg-brand/10 sm:flex-row sm:gap-1.5"
            asChild
          >
            <Link href={icalHref} data-testid="partner-cal-quick-ical">
              <CalendarSync className="h-4 w-4 shrink-0" aria-hidden />
              <span className="text-xs font-semibold sm:text-sm">{t('partnerCal_quickIcal')}</span>
            </Link>
          </Button>
        </div>

        <div className="flex items-stretch gap-2">
          <div
            className="flex min-h-11 min-w-0 flex-1 overflow-hidden rounded-xl border border-slate-200"
            role="group"
            aria-label={t('partnerCal_viewModeAria')}
          >
            <button
              type="button"
              onClick={() => onMobilePaneChange('near')}
              className={modeBtn(mobilePane === 'near')}
              data-testid="partner-cal-window-10"
            >
              <CalendarRange className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="text-center">{t('partnerCal_windowNear')}</span>
            </button>
            <button
              type="button"
              onClick={() => onMobilePaneChange('month')}
              className={cn(modeBtn(mobilePane === 'month'), 'border-l border-slate-200')}
              data-testid="partner-cal-window-month"
            >
              <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="text-center">{t('partnerCal_windowMonth')}</span>
            </button>
            <button
              type="button"
              onClick={() => onMobilePaneChange('overview')}
              className={cn(modeBtn(mobilePane === 'overview'), 'border-l border-slate-200')}
              data-testid="partner-cal-window-overview"
              title={t('partnerCal_windowOverviewTitle')}
            >
              <LayoutGrid className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="text-center">{t('partnerCal_windowOverview')}</span>
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            className="min-h-11 min-w-11 shrink-0 px-0"
            aria-label={t('partnerCal_optionsAria')}
            onClick={() => setOptionsOpen(true)}
            data-testid="partner-cal-options"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Sheet open={optionsOpen} onOpenChange={setOptionsOpen}>
        <SheetContent
          side="bottom"
          overlayClassName="z-[340]"
          className={cn(
            'z-[350] rounded-t-2xl border-t border-slate-200 px-4 pt-3',
            'pb-[max(1rem,calc(env(safe-area-inset-bottom)+var(--app-bottom-nav-height,0px)))]',
          )}
        >
          <SheetHeader className="mb-3 pr-16 text-left">
            <SheetTitle>{t('partnerCal_optionsTitle')}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-2 pb-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full justify-start"
              onClick={() => {
                setOptionsOpen(false)
                onOpenPrices?.()
              }}
            >
              <DollarSign className="mr-2 h-4 w-4 shrink-0" aria-hidden />
              {t('partnerCal_setPrices')}
            </Button>
            {onIcalSyncAll ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11 w-full justify-start"
                disabled={icalSyncing}
                onClick={() => {
                  setOptionsOpen(false)
                  onIcalSyncAll()
                }}
              >
                {icalSyncing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <CalendarSync className="mr-2 h-4 w-4 shrink-0" aria-hidden />
                )}
                {t('partnerCal_syncAllIcal')}
              </Button>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
