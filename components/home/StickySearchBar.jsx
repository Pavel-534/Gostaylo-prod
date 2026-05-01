'use client'

/**
 * StickySearchBar — compact sticky поисковая панель.
 *
 * UX (Airbnb-like):
 *   - При скролле ниже hero (~280px) появляется fixed-бар под header'ом.
 *   - Одна строка: Категория · Локация · Даты · Гости · Поиск.
 *   - Плавная анимация (slide-down + fade), transition 200ms.
 *   - Popover/calendar поднимаются из бара с z-[200] — перекрывают весь контент ниже.
 *
 * Z-index: fixed top-[64px] z-[80] (ниже header z-[100], но выше всех контентных
 * блоков — TrustBar, TopListingsGrid не перекрывают popover).
 *
 * @created 2026-02-05 Premium Air UX & Conversion Fix
 */

import { useEffect, useMemo, useState } from 'react'
import { Search, MapPin, Users, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SearchCalendar } from '@/components/search-calendar'
import { WhereCombobox } from '@/components/search/WhereCombobox'
import { buildWhereOptions } from '@/lib/locations/where-options'
import { getStaticLocationsSeed } from '@/lib/locations/locations-seed'
import { getUIText, getCategoryName } from '@/lib/translations'
import { cn } from '@/lib/utils'

const GUEST_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8]
const APPEAR_SCROLL_PX = 280

export function StickySearchBar({
  language = 'ru',
  category,
  where,
  setWhere,
  dateRange,
  setDateRange,
  guests,
  setGuests,
  onSearch,
}) {
  const [visible, setVisible] = useState(false)
  const [locations, setLocations] = useState(getStaticLocationsSeed)
  const [locationsLoading, setLocationsLoading] = useState(true)

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
          <div className="min-w-0 flex-1 border-r border-slate-100 px-2">
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
          <div className="min-w-0 flex-1 border-r border-slate-100 px-2">
            <SearchCalendar
              value={dateRange}
              onChange={setDateRange}
              locale={language}
              placeholder={getUIText('dates', language)}
              className="min-h-[36px] justify-start border-0 px-0 text-sm shadow-none"
            />
          </div>

          {/* Guests */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                data-testid="sticky-search-guests"
                className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:border-teal-300 hover:bg-teal-50"
              >
                <Users className="h-4 w-4 text-[#006666]" />
                {guests}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2 z-[200]" align="end">
              <div className="grid grid-cols-4 gap-1">
                {GUEST_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setGuests?.(String(n))}
                    className={`rounded-md p-2 text-sm transition-colors ${guests === String(n) ? 'bg-[#006666] text-white' : 'hover:bg-slate-100'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

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
      </div>
    </div>
  )
}

export default StickySearchBar
