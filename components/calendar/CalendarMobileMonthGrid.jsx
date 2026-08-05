'use client'

/**
 * Stage 200.40 — Partner mobile month planning grid (touch-friendly).
 * One month overview per listing; tap cells = same actions as agenda/grid.
 */

import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday as isDateToday,
} from 'date-fns'
import { ru, enUS, zhCN, th as thLocale } from 'date-fns/locale'
import { Home, Anchor, Bike, Car, ChevronDown, Search } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ProxiedImage } from '@/components/proxied-image'
import { listingMatchesPartnerMobileCategoryFilter } from '@/lib/partner-calendar-filters'
import { getUIText } from '@/lib/translations'
import {
  resolveBlockedCellClass,
  resolveBookingStatusCellClass,
} from '@/lib/calendar/calendar-cell-presentation.js'
import { calendarRangeHighlightClass } from '@/lib/calendar/partner-calendar-range-utils.js'
import { CalendarListingPriceDisplay } from '@/components/calendar/calendar-listing-price-display'

const TYPE_ICONS = {
  villa: Home,
  apartment: Home,
  house: Home,
  yacht: Anchor,
  bike: Bike,
  car: Car,
  default: Home,
}

const DATE_FNS_LOCALE = { ru, en: enUS, zh: zhCN, th: thLocale }

function buildMonthMatrix(anchorDate, weekStartsOn = 1) {
  const monthStart = startOfMonth(anchorDate)
  const monthEnd = endOfMonth(anchorDate)
  const gridStart = startOfWeek(monthStart, { weekStartsOn })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
  const weeks = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }
  return { monthStart, monthEnd, weeks }
}

function cellSurfaceClass(cellData) {
  if (!cellData || cellData.status === 'AVAILABLE') {
    return 'bg-white hover:bg-slate-50 active:bg-slate-100'
  }
  if (cellData.status === 'BOOKED') {
    return resolveBookingStatusCellClass(cellData.bookingStatus)
  }
  if (cellData.status === 'BLOCKED') {
    return resolveBlockedCellClass(cellData)
  }
  return 'bg-slate-50'
}

export function CalendarMobileMonthGrid({
  dates,
  listings,
  onCellClick,
  getCellRangeRole,
  todayAnchorRef = null,
  initialExpandedListingId = null,
  language = 'ru',
  /** YYYY-MM-dd — month being viewed (start of month preferred) */
  monthAnchor,
}) {
  const t = (key) => getUIText(key, language)
  const dfLocale = DATE_FNS_LOCALE[language] || ru
  const weekStartsOn = 1
  const categoryChips = useMemo(
    () => [
      { key: 'all', label: t('partnerCal_categoryAll') },
      { key: 'villas', label: t('partnerCal_categoryVillas') },
      { key: 'transport', label: t('partnerCal_categoryTransport') },
      { key: 'tours', label: t('partnerCal_categoryTours') },
    ],
    [language],
  )

  const [categoryFilter, setCategoryFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedIds, setExpandedIds] = useState(() => new Set())

  const anchor = useMemo(() => {
    try {
      return parseISO(monthAnchor || dates?.[0] || format(new Date(), 'yyyy-MM-dd'))
    } catch {
      return new Date()
    }
  }, [monthAnchor, dates])

  const { monthStart, weeks } = useMemo(
    () => buildMonthMatrix(anchor, weekStartsOn),
    [anchor],
  )

  const weekdayLabels = useMemo(() => {
    const sample = weeks[0] || []
    return sample.map((d) => format(d, 'EEEEE', { locale: dfLocale }))
  }, [weeks, dfLocale])

  useEffect(() => {
    if (initialExpandedListingId) {
      setExpandedIds(new Set([initialExpandedListingId]))
      return
    }
    if (listings.length === 1) {
      setExpandedIds(new Set([listings[0].listing.id]))
    }
  }, [initialExpandedListingId, listings])

  const filteredListings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return listings.filter((item) => {
      if (!listingMatchesPartnerMobileCategoryFilter(item.listing, categoryFilter)) return false
      if (!q) return true
      return String(item.listing.title || '')
        .toLowerCase()
        .includes(q)
    })
  }, [listings, categoryFilter, searchQuery])

  const toggleExpanded = useCallback((id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const dateSet = useMemo(() => new Set(dates || []), [dates])

  return (
    <Card className="overflow-hidden border-0 shadow-lg" data-testid="partner-cal-mobile-month">
      <div className="space-y-3 border-b border-slate-200 bg-slate-50/90 px-3 py-3">
        <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categoryChips.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setCategoryFilter(key)}
              className={cn(
                'min-h-[44px] shrink-0 rounded-full border px-4 py-2.5 text-xs font-semibold transition-colors',
                categoryFilter === key
                  ? 'border-brand bg-brand text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('partnerCal_searchPlaceholder')}
            className="h-10 border-slate-200 bg-white pl-9 text-sm"
            aria-label={t('partnerCal_searchPlaceholder')}
          />
        </div>
        {filteredListings.length === 0 ? (
          <p className="text-center text-xs text-slate-500">{t('partnerCal_noListingsFilter')}</p>
        ) : null}
      </div>

      <div className="divide-y divide-slate-200">
        {filteredListings.map((item, listingIndex) => {
          const TypeIcon = TYPE_ICONS[item.listing.type] || TYPE_ICONS.default
          const id = item.listing.id
          const expanded = expandedIds.has(id) || filteredListings.length === 1
          const baseCur = String(
            item.listing.baseCurrency || item.listing.base_currency || 'THB',
          ).toUpperCase()

          return (
            <section key={id} className="bg-white">
              {filteredListings.length > 1 ? (
                <button
                  type="button"
                  onClick={() => toggleExpanded(id)}
                  className="flex w-full min-h-[44px] items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-left touch-manipulation active:bg-slate-50"
                >
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {item.listing.coverImage ? (
                      <ProxiedImage
                        src={item.listing.coverImage}
                        alt={item.listing.title}
                        fill
                        className="object-cover"
                        sizes="44px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <TypeIcon className="h-5 w-5 text-slate-400" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold leading-snug text-slate-900">
                      {item.listing.title}
                    </h3>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">
                      {format(monthStart, 'LLLL yyyy', { locale: dfLocale })}
                    </p>
                  </div>
                  <ChevronDown
                    className={cn(
                      'h-5 w-5 shrink-0 text-slate-400 transition-transform',
                      expanded && 'rotate-180',
                    )}
                  />
                </button>
              ) : null}

              {expanded ? (
                <div
                  ref={listingIndex === 0 ? todayAnchorRef : undefined}
                  className={cn('px-2 pb-3 pt-2', listingIndex === 0 && 'scroll-mt-[5.5rem]')}
                >
                  {filteredListings.length === 1 ? (
                    <p className="mb-2 truncate px-1 text-sm font-semibold text-slate-800">
                      {item.listing.title}
                    </p>
                  ) : null}

                  <div className="mb-1 grid grid-cols-7 gap-0.5">
                    {weekdayLabels.map((label, i) => (
                      <div
                        key={`${id}-wd-${i}`}
                        className="py-1 text-center text-[10px] font-semibold uppercase text-slate-500"
                      >
                        {label}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-0.5">
                    {weeks.flat().map((day) => {
                      const inMonth = isSameMonth(day, monthStart)
                      const dateStr = format(day, 'yyyy-MM-dd')
                      const inFetched = dateSet.has(dateStr)
                      const cellData = inMonth
                        ? item.availability[dateStr] || { status: 'AVAILABLE' }
                        : null
                      const today = isDateToday(day)
                      const rangeRole = getCellRangeRole?.(id, dateStr) ?? null
                      const interactive = inMonth && inFetched
                      const price =
                        cellData?.status === 'AVAILABLE'
                          ? cellData.priceThb || item.listing.basePriceThb
                          : null
                      const hasPromo = !!(cellData?.marketingPromo)

                      return (
                        <button
                          key={`${id}-${dateStr}`}
                          type="button"
                          disabled={!interactive}
                          data-testid={interactive ? 'partner-cal-cell' : undefined}
                          data-date={interactive ? dateStr : undefined}
                          data-status={interactive ? cellData?.status : undefined}
                          data-listing-id={interactive ? id : undefined}
                          onClick={() => {
                            if (!interactive || !cellData) return
                            onCellClick(item.listing, dateStr, cellData)
                          }}
                          className={cn(
                            'relative flex min-h-[48px] flex-col items-stretch rounded-lg border p-0.5 text-left transition-colors touch-manipulation',
                            !inMonth && 'border-transparent bg-transparent opacity-35',
                            inMonth && !inFetched && 'border-slate-100 bg-slate-50 opacity-60',
                            interactive && 'border-slate-200',
                            interactive && cellSurfaceClass(cellData),
                            today && interactive && 'ring-2 ring-brand ring-offset-1',
                            interactive &&
                              cellData?.status === 'AVAILABLE' &&
                              calendarRangeHighlightClass(rangeRole),
                          )}
                          aria-label={
                            inMonth
                              ? format(day, 'd MMMM yyyy', { locale: dfLocale })
                              : undefined
                          }
                          aria-current={today ? 'date' : undefined}
                        >
                          <span
                            className={cn(
                              'text-[11px] font-bold leading-none',
                              today && interactive && 'text-brand-hover',
                              interactive &&
                                (cellData?.status === 'BOOKED' || cellData?.status === 'BLOCKED') &&
                                'text-inherit',
                              interactive &&
                                cellData?.status === 'AVAILABLE' &&
                                !today &&
                                'text-slate-800',
                            )}
                          >
                            {format(day, 'd')}
                          </span>
                          {interactive && price != null ? (
                            <span className="mt-auto truncate text-[8px] font-semibold tabular-nums leading-tight opacity-90">
                              <CalendarListingPriceDisplay
                                amountThb={price}
                                baseCurrency={baseCur}
                                amountAsset={
                                  Number(price) === Number(item.listing.basePriceThb) &&
                                  item.listing?.basePriceAsset?.amount != null
                                    ? item.listing.basePriceAsset.amount
                                    : null
                                }
                                className="items-start"
                                priceClassName="text-[8px] font-semibold tabular-nums leading-tight"
                                hideApprox
                              />
                            </span>
                          ) : null}
                          {hasPromo ? (
                            <span
                              className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-brand"
                              aria-hidden
                            />
                          ) : null}
                        </button>
                      )
                    })}
                  </div>

                  <p className="mt-2 px-1 text-[11px] leading-snug text-slate-500">
                    {t('partnerCal_monthGridHint')}
                  </p>
                </div>
              ) : null}
            </section>
          )
        })}
      </div>
    </Card>
  )
}
