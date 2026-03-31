'use client'

/**
 * Мобильный мастер-календарь партнёра (< lg): фильтры по категориям из БД, поиск, аккордеон,
 * компактные строки дат и режим «10 дней / весь период».
 *
 * @param {React.RefObject<HTMLElement|null>} [props.todayAnchorRef] — якорь для «Сегодня»
 * @param {string} [props.initialExpandedListingId] — развернуть объект (например из ?listingId=)
 * @param {boolean} [props.bare] — встроенный вид (чат): без панели фильтров, все секции открыты
 */

import { useEffect, useMemo, useState, useCallback } from 'react'
import { format, parseISO, isToday as isDateToday, addDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Home, Anchor, Bike, Car, Lock, ChevronDown, Search } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ProxiedImage } from '@/components/proxied-image'
import { listingMatchesPartnerMobileCategoryFilter } from '@/lib/partner-calendar-filters'

const TYPE_ICONS = {
  villa: Home,
  apartment: Home,
  house: Home,
  yacht: Anchor,
  bike: Bike,
  car: Car,
  default: Home,
}

const STATUS_BADGE = {
  CONFIRMED: 'bg-teal-600 text-white',
  PENDING: 'bg-amber-400 text-amber-950',
  PAID: 'bg-emerald-600 text-white',
  BLOCKED: 'bg-slate-400 text-white',
  AVAILABLE: 'bg-slate-100 text-slate-800 border border-slate-200',
}

const CATEGORY_CHIPS = [
  { key: 'all', label: 'Все' },
  { key: 'villas', label: 'Виллы' },
  { key: 'transport', label: 'Транспорт' },
  { key: 'tours', label: 'Туры' },
]

const SHORT_WINDOW = 10

const TODAY_SCROLL_MARGIN = 'scroll-mt-[5.5rem]'

function findBookingCheckoutLabel(availability, datesSorted, startDateStr) {
  const cell = availability[startDateStr]
  if (!cell || cell.status !== 'BOOKED' || cell.bookingId == null) return null
  const bid = cell.bookingId
  let lastNight = startDateStr
  for (const d of datesSorted) {
    if (d < startDateStr) continue
    const c = availability[d]
    if (c?.status === 'BOOKED' && c.bookingId === bid && d >= lastNight) lastNight = d
  }
  try {
    return format(addDays(parseISO(lastNight), 1), 'd MMM', { locale: ru })
  } catch {
    return null
  }
}

function buildCollapsedSummary(item, dates) {
  const { availability } = item
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const anchorDate = dates.includes(todayStr) ? todayStr : dates[0]
  if (!anchorDate) return { text: 'Нет дат в окне', tone: 'muted' }

  const cell = availability[anchorDate] || { status: 'AVAILABLE' }
  const prefix = anchorDate === todayStr ? 'Сегодня: ' : ''

  if (cell.status === 'BOOKED') {
    const until = findBookingCheckoutLabel(availability, dates, anchorDate)
    if (until) return { text: `${prefix}Занято до ${until}`, tone: 'busy' }
    return { text: `${prefix}Занято`, tone: 'busy' }
  }
  if (cell.status === 'BLOCKED') {
    return { text: `${prefix}Закрыто`, tone: 'block' }
  }
  return { text: `${prefix}Свободно`, tone: 'free' }
}

export function CalendarMobileAgenda({
  dates,
  listings,
  onCellClick,
  bare = false,
  todayAnchorRef = null,
  initialExpandedListingId = null,
}) {
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedIds, setExpandedIds] = useState(() => new Set())
  const [fullMonthById, setFullMonthById] = useState({})

  const firstTodayInRange = useMemo(
    () => dates.find((d) => isDateToday(parseISO(d))),
    [dates],
  )

  useEffect(() => {
    if (bare) {
      setExpandedIds(new Set(listings.map((x) => x.listing.id)))
    }
  }, [bare, listings])

  useEffect(() => {
    if (!bare && initialExpandedListingId) {
      setExpandedIds(new Set([initialExpandedListingId]))
    }
  }, [bare, initialExpandedListingId])

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

  const toggleFullMonth = useCallback((id) => {
    setFullMonthById((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const toolbar = !bare && (
    <div className="space-y-3 border-b border-slate-200 bg-slate-50/90 px-3 py-3">
      <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CATEGORY_CHIPS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setCategoryFilter(key)}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
              categoryFilter === key
                ? 'border-teal-600 bg-teal-600 text-white'
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
          placeholder="Поиск по названию…"
          className="h-10 border-slate-200 bg-white pl-9 text-sm"
          aria-label="Поиск объекта по названию"
        />
      </div>
      {filteredListings.length === 0 ? (
        <p className="text-center text-xs text-slate-500">Нет объектов по фильтру</p>
      ) : null}
    </div>
  )

  const inner = (
    <div className="divide-y divide-slate-200">
      {toolbar}
      {filteredListings.map((item, listingIndex) => {
        const TypeIcon = TYPE_ICONS[item.listing.type] || TYPE_ICONS.default
        const id = item.listing.id
        const expanded = bare || expandedIds.has(id)
        const summary = buildCollapsedSummary(item, dates)
        const showFull = !!fullMonthById[id]
        const visibleDates =
          expanded && !showFull ? dates.slice(0, Math.min(SHORT_WINDOW, dates.length)) : dates
        const showTodayInSlice = !!(firstTodayInRange && visibleDates.includes(firstTodayInRange))

        const summaryClass =
          summary.tone === 'busy'
            ? 'text-amber-800'
            : summary.tone === 'block'
              ? 'text-slate-600'
              : summary.tone === 'muted'
                ? 'text-slate-400'
                : 'text-teal-700'

        const headerAsTodayAnchor =
          !!todayAnchorRef &&
          !!firstTodayInRange &&
          listingIndex === 0 &&
          (!expanded || !showTodayInSlice)

        return (
          <section key={id} className="bg-white">
            <button
              type="button"
              ref={headerAsTodayAnchor ? todayAnchorRef : undefined}
              onClick={() => !bare && toggleExpanded(id)}
              className={cn(
                'flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-left transition-colors',
                'touch-manipulation',
                !bare && 'active:bg-slate-50',
                headerAsTodayAnchor ? TODAY_SCROLL_MARGIN : undefined,
              )}
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
                <h3 className="text-sm font-bold leading-snug text-slate-900">{item.listing.title}</h3>
                <p className={cn('mt-0.5 truncate text-xs font-medium', summaryClass)}>{summary.text}</p>
                <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-500">
                  <TypeIcon className="h-3 w-3 shrink-0" />
                  {item.listing.district}
                </p>
              </div>
              {!bare ? (
                <ChevronDown
                  className={cn(
                    'h-5 w-5 shrink-0 text-slate-400 transition-transform',
                    expanded && 'rotate-180',
                  )}
                />
              ) : null}
            </button>

            {expanded ? (
              <div className="pb-1">
                {dates.length > SHORT_WINDOW ? (
                  <div className="flex justify-center border-b border-slate-100 px-2 py-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleFullMonth(id)
                      }}
                      className="text-xs font-semibold text-teal-700 underline-offset-2 hover:underline"
                    >
                      {showFull ? `Свернуть до ${SHORT_WINDOW} дней` : 'Показать весь месяц'}
                    </button>
                  </div>
                ) : null}
                <ul className="px-0">
                  {visibleDates.map((date) => {
                    const attachTodayAnchor =
                      !!todayAnchorRef &&
                      expanded &&
                      showTodayInSlice &&
                      firstTodayInRange === date &&
                      listingIndex === 0
                    return (
                      <AgendaRow
                        key={`${id}-${date}`}
                        date={date}
                        item={item}
                        onCellClick={onCellClick}
                        listItemRef={attachTodayAnchor ? todayAnchorRef : undefined}
                        todayScrollMarginClass={attachTodayAnchor ? TODAY_SCROLL_MARGIN : undefined}
                      />
                    )
                  })}
                </ul>
              </div>
            ) : null}
          </section>
        )
      })}
    </div>
  )

  if (bare) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">{inner}</div>
    )
  }

  return <Card className="overflow-hidden border-0 shadow-lg">{inner}</Card>
}

function AgendaRow({ date, item, onCellClick, listItemRef, todayScrollMarginClass }) {
  const cellData = item.availability[date] || { status: 'AVAILABLE' }
  const dateObj = parseISO(date)
  const today = isDateToday(dateObj)
  const weekend = dateObj.getDay() === 0 || dateObj.getDay() === 6

  let badgeClass = STATUS_BADGE.AVAILABLE
  let label = 'Свободно'
  let sub = null
  let priceLine = null

  if (cellData.status === 'BOOKED') {
    badgeClass = STATUS_BADGE[cellData.bookingStatus] || STATUS_BADGE.CONFIRMED
    label =
      cellData.bookingStatus === 'PENDING'
        ? 'Ожидает'
        : cellData.bookingStatus === 'PAID'
          ? 'Оплачено'
          : 'Бронь'
    sub = cellData.guestName || 'Гость'
  } else if (cellData.status === 'BLOCKED') {
    badgeClass = STATUS_BADGE.BLOCKED
    label = 'Закрыто'
    sub = cellData.reason ? String(cellData.reason).slice(0, 36) : null
  } else {
    const price = cellData.priceThb || item.listing.basePriceThb
    const basePrice = item.listing.basePriceThb
    const high = price > basePrice
    const low = price < basePrice
    const minStay = cellData.minStay || 1
    priceLine = (
      <div className="text-right leading-tight">
        <span
          className={cn(
            'text-sm font-bold tabular-nums tracking-tight',
            high && 'text-teal-700',
            low && 'text-slate-500',
            !high && !low && 'text-slate-900',
          )}
        >
          ฿{Math.round(price).toLocaleString('en-US')}
        </span>
        {minStay > 1 ? <p className="text-[10px] font-medium text-slate-500">мин.{minStay}</p> : null}
      </div>
    )
    label = 'Свободно'
  }

  return (
    <li ref={listItemRef} className={cn(todayScrollMarginClass)}>
      <button
        type="button"
        onClick={() => onCellClick(item.listing, date, cellData)}
        className={cn(
          'flex w-full min-h-[44px] items-center gap-2 border-b border-slate-100 px-2.5 py-1.5 text-left transition-colors',
          'touch-manipulation active:bg-slate-100',
          today && 'bg-teal-50/80 ring-1 ring-inset ring-teal-400/50',
          weekend && cellData.status === 'AVAILABLE' && !today && 'bg-slate-50/40',
        )}
      >
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg border font-bold',
            today ? 'border-teal-600 bg-white text-teal-800' : 'border-slate-200 bg-white text-slate-800',
          )}
        >
          <span className="text-[9px] font-semibold uppercase leading-none text-slate-500">
            {format(dateObj, 'EEE', { locale: ru })}
          </span>
          <span className="text-base leading-none">{format(dateObj, 'd')}</span>
          <span className="text-[8px] font-medium text-slate-500">{format(dateObj, 'MMM', { locale: ru })}</span>
        </div>

        <div className="min-w-0 flex-1">
          <span
            className={cn(
              'inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
              badgeClass,
            )}
          >
            {label}
          </span>
          {sub ? <p className="mt-0.5 truncate text-xs font-semibold text-slate-800">{sub}</p> : null}
        </div>

        {priceLine ? <div className="shrink-0 pl-1">{priceLine}</div> : null}

        {cellData.status === 'BLOCKED' && !priceLine ? (
          <div className="shrink-0 text-slate-500">
            <Lock className="h-5 w-5" aria-hidden />
          </div>
        ) : null}
      </button>
    </li>
  )
}
