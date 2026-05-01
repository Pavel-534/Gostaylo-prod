'use client'

/**
 * MobileSearchBottomSheet — FAB + Bottom Sheet поиск для мобильных.
 *
 * Архитектура:
 * - FAB: pill-кнопка зафиксирована над tabbar (bottom-[80px])
 * - Bottom Sheet: слайд снизу, полный поиск с функциональными контролами
 * - Категории: горизонтальный scroll (NO wrap)
 * - Локация: quick chips (Patong, Kamala, Bang Tao, Kata, Rawai, Karon, All)
 * - Даты: two native date inputs (checkIn → checkOut)
 * - Гости: +/- counter
 * - На "Найти" → onSearch() навигация на /listings с применёнными фильтрами
 *
 * SSOT: принимает те же пропсы что и HomeHeroLuxe, через useHomeFilters.
 * Используется в GostayloHomeContent (только mobile: md:hidden).
 *
 * @created 2026-02 Sprint P3 — Premium Air, мобильная оптимизация
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Search, X, MapPin, Calendar as CalendarIcon, Users, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { getCategoryName, getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'

/** Популярные локации Пхукета — синхрон с WhereCombobox */
const POPULAR_LOCATIONS = [
  { value: 'all',      labels: { ru: 'Весь Пхукет', en: 'All Phuket', zh: '全普吉岛', th: 'ภูเก็ตทั้งหมด' } },
  { value: 'patong',   labels: { ru: 'Патонг',     en: 'Patong',     zh: '芭东',    th: 'ป่าตอง' } },
  { value: 'kamala',   labels: { ru: 'Камала',     en: 'Kamala',     zh: '卡马拉',  th: 'กมลา' } },
  { value: 'bang_tao', labels: { ru: 'Банг Тао',   en: 'Bang Tao',   zh: '邦涛',    th: 'บางเทา' } },
  { value: 'kata',     labels: { ru: 'Ката',       en: 'Kata',       zh: '卡塔',    th: 'กะตะ' } },
  { value: 'rawai',    labels: { ru: 'Равай',      en: 'Rawai',      zh: '拉威',    th: 'ราไวย์' } },
  { value: 'karon',    labels: { ru: 'Карон',      en: 'Karon',      zh: '卡伦',    th: 'กะรน' } },
]

// ---------- FAB Button ----------
export function MobileSearchFAB({ onClick, language = 'ru', hasActiveFilters = false }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 160)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={getUIText('findButton', language)}
      data-testid="mobile-search-fab"
      className={cn(
        'fixed bottom-[80px] left-1/2 z-40 -translate-x-1/2',
        'flex items-center gap-2 rounded-full bg-[#006666] px-5 py-3',
        'text-sm font-semibold text-white',
        'shadow-[0_10px_30px_rgba(0,102,102,0.45)]',
        'transition-all duration-300 ease-out will-change-transform',
        'active:scale-95',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0 pointer-events-none',
        'md:hidden',
      )}
    >
      <Search className="h-4 w-4" />
      <span>{getUIText('findButton', language)}</span>
      {hasActiveFilters && (
        <span className="ml-1 flex h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
      )}
    </button>
  )
}

// ---------- Bottom Sheet ----------
export function MobileSearchBottomSheet({
  open,
  onClose,
  language = 'ru',
  // State (SSOT — проксируется из useHomeFilters)
  categoryTabs = [],
  category,
  setCategory,
  where,
  setWhere,
  dateRange,
  setDateRange,
  guests,
  setGuests,
  onSearch,
}) {
  const sheetRef = useRef(null)

  // Закрытие по Escape + lock body scroll
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  const handleSearch = useCallback(() => {
    onSearch?.()
    onClose()
  }, [onSearch, onClose])

  // ---- Dates (native inputs) ----
  const checkInStr = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : ''
  const checkOutStr = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : ''
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const handleCheckInChange = (e) => {
    const v = e.target.value
    const from = v ? new Date(v + 'T00:00:00') : null
    const nextTo = dateRange?.to && from && dateRange.to < from ? null : dateRange?.to ?? null
    setDateRange?.({ from, to: nextTo })
  }
  const handleCheckOutChange = (e) => {
    const v = e.target.value
    const to = v ? new Date(v + 'T00:00:00') : null
    setDateRange?.({ from: dateRange?.from ?? null, to })
  }

  const displayTabs = categoryTabs.length > 0 ? categoryTabs : [
    { slug: 'property' },
    { slug: 'vehicles' },
    { slug: 'yachts' },
    { slug: 'tours' },
  ]

  const sectionLabel = (ru, en) => language === 'ru' ? ru : en

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 bg-slate-900/55 backdrop-blur-sm transition-opacity duration-300 md:hidden',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        aria-hidden
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={getUIText('findButton', language)}
        data-testid="mobile-search-sheet"
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-3xl bg-white md:hidden',
          'shadow-[0_-24px_64px_rgba(15,23,42,0.22)]',
          'transition-transform duration-300 ease-out will-change-transform',
          open ? 'translate-y-0' : 'translate-y-full',
        )}
        style={{ maxHeight: '92dvh', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1" aria-hidden>
          <div className="h-1 w-10 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-3">
          <h2 className="font-serif text-2xl font-semibold tracking-tight text-slate-900">
            {sectionLabel('Поиск', 'Search')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            data-testid="mobile-search-close"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 pt-1">

          {/* Category tabs — horizontal scroll */}
          <div className="mb-5">
            <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              {sectionLabel('Категория', 'Category')}
            </p>
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 scrollbar-none">
              {displayTabs.map((tab) => {
                const active = category === tab.slug
                return (
                  <button
                    key={tab.slug}
                    type="button"
                    onClick={() => setCategory?.(tab.slug)}
                    data-testid={`mobile-search-category-${tab.slug}`}
                    className={cn(
                      'shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-150 active:scale-95',
                      active
                        ? 'border-[#006666] bg-[#006666] text-white shadow-[0_4px_12px_rgba(0,102,102,0.28)]'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-teal-300 hover:bg-white',
                    )}
                  >
                    {getCategoryName(tab.slug, language, tab.name)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Location — popular chips */}
          <div className="mb-5">
            <div className="mb-2 flex items-center gap-1.5">
              <MapPin className="h-3 w-3 text-teal-600" />
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                {sectionLabel('Локация', 'Location')}
              </p>
            </div>
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 scrollbar-none">
              {POPULAR_LOCATIONS.map((loc) => {
                const active = where === loc.value || (!where && loc.value === 'all')
                return (
                  <button
                    key={loc.value}
                    type="button"
                    onClick={() => setWhere?.(loc.value)}
                    data-testid={`mobile-search-location-${loc.value}`}
                    className={cn(
                      'shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-150 active:scale-95',
                      active
                        ? 'border-teal-600 bg-teal-50 text-teal-800'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300',
                    )}
                  >
                    {loc.labels[language] || loc.labels.en}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Dates — two native inputs */}
          <div className="mb-5">
            <div className="mb-2 flex items-center gap-1.5">
              <CalendarIcon className="h-3 w-3 text-teal-600" />
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                {sectionLabel('Даты', 'Dates')}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="relative flex flex-col rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 transition-colors focus-within:border-teal-400 focus-within:bg-white">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {sectionLabel('Заезд', 'Check-in')}
                </span>
                <input
                  type="date"
                  value={checkInStr}
                  min={todayStr}
                  onChange={handleCheckInChange}
                  data-testid="mobile-search-checkin"
                  className="mt-0.5 w-full bg-transparent text-sm font-semibold text-slate-800 outline-none"
                />
              </label>
              <label className="relative flex flex-col rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 transition-colors focus-within:border-teal-400 focus-within:bg-white">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {sectionLabel('Выезд', 'Check-out')}
                </span>
                <input
                  type="date"
                  value={checkOutStr}
                  min={checkInStr || todayStr}
                  onChange={handleCheckOutChange}
                  data-testid="mobile-search-checkout"
                  className="mt-0.5 w-full bg-transparent text-sm font-semibold text-slate-800 outline-none"
                />
              </label>
            </div>
          </div>

          {/* Guests */}
          <div className="mb-6">
            <div className="mb-2 flex items-center gap-1.5">
              <Users className="h-3 w-3 text-teal-600" />
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                {sectionLabel('Гости', 'Guests')}
              </p>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3">
              <span className="text-sm text-slate-600">
                {sectionLabel('Количество гостей', 'Number of guests')}
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setGuests?.(String(Math.max(1, parseInt(guests || '1', 10) - 1)))}
                  aria-label="Decrease guests"
                  data-testid="mobile-search-guests-dec"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-lg text-slate-600 transition-colors hover:border-teal-400 hover:text-teal-700 active:scale-90 disabled:opacity-40"
                  disabled={parseInt(guests || '1', 10) <= 1}
                >
                  −
                </button>
                <span className="w-6 text-center text-lg font-bold tabular-nums text-slate-800" data-testid="mobile-search-guests-value">
                  {guests || '1'}
                </span>
                <button
                  type="button"
                  onClick={() => setGuests?.(String(Math.min(20, parseInt(guests || '1', 10) + 1)))}
                  aria-label="Increase guests"
                  data-testid="mobile-search-guests-inc"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-lg text-slate-600 transition-colors hover:border-teal-400 hover:text-teal-700 active:scale-90"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky footer — Search button */}
        <div className="border-t border-slate-100 bg-white px-5 py-3.5">
          <button
            type="button"
            onClick={handleSearch}
            data-testid="mobile-search-submit"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#006666] py-4 text-base font-bold text-white shadow-[0_10px_28px_rgba(0,102,102,0.32)] transition-all hover:bg-[#005555] active:scale-[0.98]"
          >
            <Search className="h-5 w-5" />
            {getUIText('findButton', language)}
          </button>
        </div>
      </div>
    </>
  )
}
