/**
 * Stage 194.0-B — Mobile calendar first-run strip.
 * Primary: Block dates · iCal. Secondary (Options): bulk prices · force sync.
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
 *   agendaCompact: boolean
 *   onAgendaCompactChange: (compact: boolean) => void
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
  agendaCompact,
  onAgendaCompactChange,
  onQuickBlock,
  onOpenPrices,
  onIcalSyncAll,
  icalSyncing = false,
  className,
}) {
  const t = (key) => getUIText(key, language)
  const [optionsOpen, setOptionsOpen] = useState(false)

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
            className="min-h-11 w-full justify-center gap-1.5"
            onClick={onQuickBlock}
            data-testid="partner-cal-quick-block"
          >
            <Lock className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate text-sm">{t('partnerCal_quickBlock')}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full justify-center gap-1.5 border-brand/30 text-brand hover:bg-brand/10"
            asChild
          >
            <Link href={icalHref} data-testid="partner-cal-quick-ical">
              <CalendarSync className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate text-sm">{t('partnerCal_quickIcal')}</span>
            </Link>
          </Button>
        </div>

        <div className="flex gap-2">
          <div className="flex min-h-11 flex-1 overflow-hidden rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => onAgendaCompactChange(true)}
              className={cn(
                'flex min-h-11 flex-1 items-center justify-center gap-1 px-2 text-xs font-semibold transition-colors',
                agendaCompact ? 'bg-brand text-white' : 'bg-white text-slate-600 hover:bg-slate-50',
              )}
              data-testid="partner-cal-window-10"
            >
              <CalendarRange className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {t('partnerCal_windowTen')}
            </button>
            <button
              type="button"
              onClick={() => onAgendaCompactChange(false)}
              className={cn(
                'flex min-h-11 flex-1 items-center justify-center px-2 text-xs font-semibold transition-colors',
                !agendaCompact ? 'bg-brand text-white' : 'bg-white text-slate-600 hover:bg-slate-50',
              )}
              data-testid="partner-cal-window-month"
            >
              {t('partnerCal_windowMonth')}
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
          <SheetHeader className="mb-3 text-left">
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
              <DollarSign className="mr-2 h-4 w-4" aria-hidden />
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
                  <CalendarSync className="mr-2 h-4 w-4" aria-hidden />
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
