'use client'

/**
 * StickySearchBar — compact sticky поисковая панель + Summary Chips.
 *
 * UX (Airbnb-like):
 *   - При скролле ниже hero (~280px) появляется fixed-бар под header'ом.
 *   - Одна строка: Категория · Локация · Даты · Гости · Поиск.
 *   - Вторая строка (если есть активные фильтры) — Summary Chips: «Phuket • 12–19 May • 2 guests».
 *     Клик по чипу фокусирует соответствующее поле (Where/Dates/Guests).
 *   - Плавная анимация (slide-down + fade), transition 300ms.
 *   - Popover/calendar поднимаются из бара с z-[200] — перекрывают весь контент ниже.
 *
 * Z-index: fixed top-[64px] z-[80] (ниже header z-[100], но выше всех контентных
 * блоков — TrustBar, TopListingsGrid не перекрывают popover).
 *
 * @created 2026-02-05 Premium Air UX & Conversion Fix
 * @updated 2026-02-05 Conversion Polish — Summary Chips с фокусом на поля
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, MapPin, Users, Layers, Calendar, X } from 'lucide-react'
import { format, isSameDay } from 'date-fns'
import { ru as ruLocale } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { SearchCalendar } from '@/components/search-calendar'
import { WhereCombobox } from '@/components/search/WhereCombobox'
import { GuestsPopover, formatGuestsSummaryText } from '@/components/search/GuestsPopover'
import { buildWhereOptions } from '@/lib/locations/where-options'
import { getStaticLocationsSeed } from '@/lib/locations/locations-seed'
import { getUIText, getCategoryName } from '@/lib/translations'
import { cn } from '@/lib/utils'
const APPEAR_SCROLL_PX = 280

/** Находим локализованный label для where-значения из плоского списка опций */
function resolveWhereLabel(whereValue, options) {
  if (!whereValue || whereValue === 'all') return null
  const v = String(whereValue).toLowerCase()
  const match = (options || []).find((o) => String(o.value).toLowerCase() === v)
  if (match?.label) return match.label
  // Fallback: title-case raw value ('phuket' → 'Phuket', 'koh-samui' → 'Koh Samui')
  return String(whereValue)
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
}

/** Форматирование диапазона дат: «12–19 мая» / «May 12–19» / «12 May – 3 Jun» */
function formatDateRangeShort(dateRange, language) {
  if (!dateRange?.from) return null
  const locale = language === 'ru' ? ruLocale : undefined
  if (!dateRange.to || isSameDay(dateRange.from, dateRange.to)) {
    return format(dateRange.from, language === 'ru' ? 'd MMM' : 'MMM d', { locale })
  }
  const sameMonth = dateRange.from.getMonth() === dateRange.to.getMonth()
  if (sameMonth) {
    const monthFmt = language === 'ru' ? 'MMM' : 'MMM'
    const m = format(dateRange.from, monthFmt, { locale })
    return `${format(dateRange.from, 'd')}–${format(dateRange.to, 'd')} ${m}`
  }
  const mk = (d) => format(d, language === 'ru' ? 'd MMM' : 'MMM d', { locale })
  return `${mk(dateRange.from)} – ${mk(dateRange.to)}`
}

export function StickySearchBar({
  language = 'ru',
  category,
  where,
  setWhere,
  dateRange,
  setDateRange,
  guests,
  setGuests,
  guestsBreakdown = null,
  setGuestsBreakdown,
  onSearch,
}) {
  const [visible, setVisible] = useState(false)
  const [locations, setLocations] = useState(getStaticLocationsSeed)
  const [locationsLoading, setLocationsLoading] = useState(true)

  // Refs на контейнеры полей — для программного focus через Summary Chips
  const whereRef = useRef(null)
  const datesRef = useRef(null)
  const guestsTriggerRef = useRef(null)

  useEffect(() => {
    fetch('/api/v2/search/locations')
      .then((r) => r.json())
      .then((locRes) => { if (locRes.success && locRes.data) setLocations(locRes.data) })
      .catch(() => {})
      .finally(() => setLocationsLoading(false))
  }, [])

  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        setVisible(window.scrollY > APPEAR_SCROLL_PX)
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const whereOptions = useMemo(() => buildWhereOptions(locations, language), [locations, language])

  const catLabel =
    category && category !== 'all'
      ? getCategoryName(category, language)
      : getUIText('mobileSearchWhatTitle', language)

  const whereLabel = useMemo(() => resolveWhereLabel(where, whereOptions), [where, whereOptions])
  const datesLabel = useMemo(() => formatDateRangeShort(dateRange, language), [dateRange, language])
  const guestsLabel = useMemo(() => {
    const b =
      guestsBreakdown && typeof guestsBreakdown === 'object'
        ? guestsBreakdown
        : { adults: Math.max(1, parseInt(guests, 10) || 1), children: 0, infants: 0 }
    const total = (b.adults || 0) + (b.children || 0) + (b.infants || 0)
    if (!total || total <= 1) return null
    return formatGuestsSummaryText(b, language)
  }, [guests, guestsBreakdown, language])

  const hasAnyFilter = Boolean(whereLabel || datesLabel || guestsLabel)

  /** Программный фокус на поле через querySelector по ref'у */
  const focusField = (ref, opts = {}) => {
    const el = ref?.current
    if (!el) return
    const btn = el.querySelector('button')
    if (btn) {
      btn.click()
      if (opts.focus !== false) btn.focus({ preventScroll: true })
    }
  }

  const handleClearWhere = (e) => { e.stopPropagation(); setWhere?.('all') }
  const handleClearDates = (e) => { e.stopPropagation(); setDateRange?.({ from: undefined, to: undefined }) }
  const handleClearGuests = (e) => {
    e.stopPropagation()
    setGuests?.('1')
    setGuestsBreakdown?.({ adults: 1, children: 0, infants: 0 })
  }

  return (
    <div
      data-testid="sticky-search-bar"
      aria-hidden={!visible}
      className={cn(
        'fixed left-0 right-0 top-16 z-[80] hidden border-b border-slate-200/80 bg-white/95 backdrop-blur-lg shadow-[0_8px_24px_rgba(0,24,24,0.08)] transition-all duration-300 md:block',
        visible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none',
      )}
    >
      <div className="container mx-auto px-4 py-2.5">
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm">
          {/* Category (display-only) */}
          <div className="hidden min-w-0 shrink-0 items-center gap-1.5 border-r border-slate-100 px-3 md:flex">
            <Layers className="h-4 w-4 shrink-0 text-[#006666]" />
            <span className="max-w-[140px] truncate text-sm font-medium text-slate-700">{catLabel}</span>
          </div>

          {/* Where */}
          <div ref={whereRef} className="min-w-0 flex-1 border-r border-slate-100 px-2">
            <WhereCombobox
              options={whereOptions}
              value={where || 'all'}
              onChange={setWhere}
              placeholder={getUIText('wherePlaceholder', language)}
              loading={locationsLoading}
              variant="hero"
              language={language}
              className="min-h-[36px] min-w-0 [&_button]:h-auto [&_button]:min-h-[36px] [&_button]:rounded-none [&_button]:border-0 [&_button]:px-0 [&_button]:text-sm [&_button]:shadow-none [&_button]:focus:ring-0"
            />
          </div>

          {/* Dates */}
          <div ref={datesRef} className="min-w-0 flex-1 border-r border-slate-100 px-2">
            <SearchCalendar
              value={dateRange}
              onChange={setDateRange}
              locale={language}
              placeholder={getUIText('dates', language)}
              className="min-h-[36px] justify-start border-0 px-0 text-sm shadow-none"
            />
          </div>

          {/* Guests (SSOT popover) */}
          <div ref={guestsTriggerRef}>
            <GuestsPopover
              language={language}
              guests={guests}
              setGuests={setGuests}
              guestsBreakdown={guestsBreakdown}
              setGuestsBreakdown={setGuestsBreakdown}
              align="end"
              triggerClassName="h-9 rounded-lg px-3 text-sm font-medium text-slate-700"
              contentClassName="z-[90]"
            />
          </div>

          {/* Search */}
          <Button
            onClick={onSearch}
            data-testid="sticky-search-submit"
            className="h-9 rounded-xl bg-[#006666] px-4 text-sm font-semibold text-white shadow-[0_6px_14px_rgba(0,102,102,0.28)] hover:bg-[#004c4c]"
          >
            <Search className="mr-1.5 h-4 w-4" />
            <span className="hidden sm:inline">{getUIText('findButton', language)}</span>
          </Button>
        </div>

        {/* Summary Chips — появляются ТОЛЬКО если есть активные фильтры */}
        {hasAnyFilter && (
          <div
            data-testid="sticky-search-summary-chips"
            className="mt-2 flex flex-wrap items-center gap-1.5 px-1"
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              {language === 'ru' ? 'Фильтры' : 'Filters'}:
            </span>
            {whereLabel && (
              <Chip
                icon={MapPin}
                testid="sticky-chip-where"
                onClick={() => focusField(whereRef)}
                onClear={handleClearWhere}
                clearAriaLabel={language === 'ru' ? 'Убрать локацию' : 'Clear location'}
              >
                {whereLabel}
              </Chip>
            )}
            {datesLabel && (
              <Chip
                icon={Calendar}
                testid="sticky-chip-dates"
                onClick={() => focusField(datesRef)}
                onClear={handleClearDates}
                clearAriaLabel={language === 'ru' ? 'Убрать даты' : 'Clear dates'}
              >
                {datesLabel}
              </Chip>
            )}
            {guestsLabel && (
              <Chip
                icon={Users}
                testid="sticky-chip-guests"
                onClick={() => guestsTriggerRef.current?.click()}
                onClear={handleClearGuests}
                clearAriaLabel={language === 'ru' ? 'Сбросить гостей' : 'Clear guests'}
              >
                {guestsLabel}
              </Chip>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Chip({ icon: Icon, children, onClick, onClear, testid, clearAriaLabel }) {
  return (
    <span
      className="group inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50/80 pl-2.5 pr-1 py-1 text-xs font-semibold text-teal-800 shadow-sm transition-all hover:border-teal-400 hover:bg-teal-100 hover:shadow"
      data-testid={testid}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-1.5 cursor-pointer focus:outline-none"
      >
        <Icon className="h-3 w-3 text-teal-600" aria-hidden />
        <span>{children}</span>
      </button>
      <button
        type="button"
        onClick={onClear}
        aria-label={clearAriaLabel}
        className="flex h-5 w-5 items-center justify-center rounded-full text-teal-500 transition-colors hover:bg-teal-200 hover:text-teal-900"
      >
        <X className="h-3 w-3" aria-hidden />
      </button>
    </span>
  )
}

export default StickySearchBar
