'use client'

/**
 * Stage 200.41 — Partner mobile 3-month overview (heatmap).
 * Status colors only — no prices. Tap month title (44px) → open Month pane for edits.
 * Day cells are visual (not primary touch targets) to keep the screen scannable.
 */

import { useEffect, useMemo, useState } from 'react'
import { format, parseISO, addMonths, isSameMonth, isToday as isDateToday } from 'date-fns'
import { ru, enUS, zhCN, th as thLocale } from 'date-fns/locale'
import { ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { getUIText } from '@/lib/translations'
import { buildPartnerMonthMatrix } from '@/lib/calendar/partner-calendar-month-matrix.js'
import {
  resolveBlockedCellClass,
  resolveBookingStatusCellClass,
} from '@/lib/calendar/calendar-cell-presentation.js'

const DATE_FNS_LOCALE = { ru, en: enUS, zh: zhCN, th: thLocale }
const OVERVIEW_MONTHS = 3

function heatClass(cellData) {
  if (!cellData || cellData.status === 'AVAILABLE') {
    return 'bg-emerald-50/90 ring-1 ring-inset ring-emerald-100'
  }
  if (cellData.status === 'BOOKED') {
    return resolveBookingStatusCellClass(cellData.bookingStatus)
  }
  if (cellData.status === 'BLOCKED') {
    return resolveBlockedCellClass(cellData)
  }
  return 'bg-slate-100'
}

export function CalendarMobileOverview({
  dates,
  listings,
  language = 'ru',
  /** Start of the 3-month window (YYYY-MM-dd) */
  monthAnchor,
  todayAnchorRef = null,
  initialListingId = null,
  /** Open Month pane for this month (YYYY-MM-dd = 1st preferred) */
  onOpenMonth,
}) {
  const t = (key) => getUIText(key, language)
  const dfLocale = DATE_FNS_LOCALE[language] || ru
  const dateSet = useMemo(() => new Set(dates || []), [dates])

  const [listingId, setListingId] = useState(() => {
    if (initialListingId) return initialListingId
    return listings?.[0]?.listing?.id || null
  })

  useEffect(() => {
    if (initialListingId) {
      setListingId(initialListingId)
      return
    }
    if (!listingId && listings?.[0]?.listing?.id) {
      setListingId(listings[0].listing.id)
    }
  }, [initialListingId, listings, listingId])

  const activeItem = useMemo(
    () => listings.find((x) => x.listing.id === listingId) || listings[0] || null,
    [listings, listingId],
  )

  const windowStart = useMemo(() => {
    try {
      return parseISO(monthAnchor || dates?.[0] || format(new Date(), 'yyyy-MM-dd'))
    } catch {
      return new Date()
    }
  }, [monthAnchor, dates])

  const monthBlocks = useMemo(() => {
    return Array.from({ length: OVERVIEW_MONTHS }, (_, i) => {
      const anchor = addMonths(windowStart, i)
      return buildPartnerMonthMatrix(anchor, 1)
    })
  }, [windowStart])

  const weekdayLabels = useMemo(() => {
    const sample = monthBlocks[0]?.weeks?.[0] || []
    return sample.map((d) => format(d, 'EEEEE', { locale: dfLocale }))
  }, [monthBlocks, dfLocale])

  if (!activeItem) return null

  return (
    <Card
      className="overflow-hidden border-0 shadow-lg"
      data-testid="partner-cal-mobile-overview"
    >
      {listings.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-slate-50/90 px-3 py-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {listings.map((item) => {
            const id = item.listing.id
            const active = id === activeItem.listing.id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setListingId(id)}
                className={cn(
                  'min-h-[44px] max-w-[11rem] shrink-0 truncate rounded-full border px-3 text-xs font-semibold transition-colors',
                  active
                    ? 'border-brand bg-brand text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100',
                )}
              >
                {item.listing.title}
              </button>
            )
          })}
        </div>
      ) : null}

      <div ref={todayAnchorRef} className="space-y-4 px-3 py-3 scroll-mt-[5.5rem]">
        <p className="text-xs leading-relaxed text-slate-600">{t('partnerCal_overviewHint')}</p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-50 ring-1 ring-emerald-200" />
            {t('partnerCal_overviewLegendFree')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-brand" />
            {t('partnerCal_overviewLegendBusy')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-slate-300" />
            {t('partnerCal_overviewLegendBlocked')}
          </span>
        </div>

        {monthBlocks.map(({ monthStart, weeks }) => {
          const monthKey = format(monthStart, 'yyyy-MM')
          const openThisMonth = () =>
            onOpenMonth?.(format(monthStart, 'yyyy-MM-dd'))

          return (
            <section
              key={monthKey}
              className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm"
            >
              <button
                type="button"
                onClick={openThisMonth}
                className="mb-2 flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl px-2 text-left touch-manipulation hover:bg-slate-50 active:bg-slate-100"
                data-testid={`partner-cal-overview-open-${monthKey}`}
              >
                <span className="text-sm font-semibold capitalize text-slate-900">
                  {format(monthStart, 'LLLL yyyy', { locale: dfLocale })}
                </span>
                <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-brand">
                  {t('partnerCal_overviewOpenMonth')}
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </span>
              </button>

              <div className="mb-1 grid grid-cols-7 gap-0.5">
                {weekdayLabels.map((label, i) => (
                  <div
                    key={`${monthKey}-wd-${i}`}
                    className="py-0.5 text-center text-[9px] font-semibold uppercase text-slate-400"
                  >
                    {label}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-0.5" aria-hidden>
                {weeks.flat().map((day) => {
                  const inMonth = isSameMonth(day, monthStart)
                  const dateStr = format(day, 'yyyy-MM-dd')
                  const cellData = inMonth
                    ? activeItem.availability[dateStr] || { status: 'AVAILABLE' }
                    : null
                  const today = isDateToday(day)
                  const fetched = dateSet.has(dateStr)

                  return (
                    <div
                      key={`${monthKey}-${dateStr}`}
                      className={cn(
                        'flex aspect-square max-h-9 items-center justify-center rounded-md text-[9px] font-semibold tabular-nums',
                        !inMonth && 'opacity-0',
                        inMonth && !fetched && 'bg-slate-50 text-slate-300',
                        inMonth && fetched && heatClass(cellData),
                        today && inMonth && 'ring-2 ring-brand ring-offset-1',
                        cellData?.status === 'BOOKED' && 'text-inherit',
                        cellData?.status === 'AVAILABLE' && 'text-slate-700',
                      )}
                    >
                      {inMonth ? format(day, 'd') : ''}
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </Card>
  )
}
