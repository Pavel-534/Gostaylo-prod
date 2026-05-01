'use client'

/**
 * MobileSearchBottomSheet — FAB + Bottom Sheet поиск для мобильных.
 *
 * Архитектура:
 * - FAB: pill-кнопка фиксированная над tabbar (bottom-[80px])
 * - Bottom Sheet: скользящий снизу лист с полным поиском
 * - Категории: горизонтальный scroll (NO flex-wrap) — главный фикс скриншота
 * - Анимация: CSS transform (без framer-motion) — 300ms ease
 *
 * SSOT: принимает те же пропсы что и HomeHeroLuxe, translations через getUIText.
 * Используется в GostayloHomeContent (мобайл-only: md:hidden).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Search, X, MapPin, Calendar, Users, ChevronDown } from 'lucide-react'
import { getCategoryName, getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'

// ---------- FAB Button ----------
export function MobileSearchFAB({ onClick, language = 'ru', hasActiveFilters = false }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Показать FAB после первого scroll
    const onScroll = () => setVisible(window.scrollY > 80)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={getUIText('findButton', language)}
      className={cn(
        // Позиция: над mobile tabbar (64px) + небольшой отступ
        'fixed bottom-[80px] left-1/2 z-40 -translate-x-1/2',
        // Pill дизайн
        'flex items-center gap-2 rounded-full bg-[#006666] px-5 py-3',
        'text-sm font-semibold text-white',
        'shadow-[0_8px_28px_rgba(0,102,102,0.45)]',
        'transition-all duration-300 ease-out',
        // Появление
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none',
        // Активные фильтры: добавляем amber dot
        'md:hidden', // только мобайл
      )}
    >
      <Search className="h-4 w-4" />
      <span>{getUIText('findButton', language)}</span>
      {hasActiveFilters && (
        <span className="ml-1 flex h-2 w-2 rounded-full bg-amber-400" />
      )}
    </button>
  )
}

// ---------- Bottom Sheet ----------
export function MobileSearchBottomSheet({
  open,
  onClose,
  language = 'ru',
  // Search state — те же пропсы что у HomeHeroLuxe
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
  const backdropRef = useRef(null)

  // Закрытие по Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    // Блокируем scroll body
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  const handleSearch = useCallback(() => {
    onSearch?.()
    onClose()
  }, [onSearch, onClose])

  // Форматируем даты для отображения
  const datesLabel = dateRange?.checkIn && dateRange?.checkOut
    ? `${new Date(dateRange.checkIn).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short' })} — ${new Date(dateRange.checkOut).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short' })}`
    : getUIText('dates', language)

  const whereLabel = where && where !== 'all' ? where : getUIText('wherePlaceholder', language)
  const displayTabs = categoryTabs.length > 0 ? categoryTabs : [
    { slug: 'property' },
    { slug: 'vehicles' },
    { slug: 'yachts' },
    { slug: 'tours' },
  ]

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 md:hidden',
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
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-3xl bg-white pb-safe md:hidden',
          'shadow-[0_-20px_60px_rgba(0,0,0,0.18)]',
          'transition-transform duration-300 ease-out will-change-transform',
          open ? 'translate-y-0' : 'translate-y-full',
        )}
        style={{ maxHeight: '92dvh' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <h2 className="font-serif text-xl font-semibold text-slate-900">
            {language === 'ru' ? 'Поиск' : language === 'zh' ? '搜索' : language === 'th' ? 'ค้นหา' : 'Search'}
          </h2>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 pb-4">

          {/* Category tabs — horizontal scroll, NO wrap (главный фикс скриншота) */}
          <div className="mb-5">
            <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              {language === 'ru' ? 'Категория' : 'Category'}
            </p>
            <div className="-mx-1 flex overflow-x-auto pb-1 scrollbar-none gap-2 px-1">
              {displayTabs.map((tab) => {
                const active = category === tab.slug
                return (
                  <button
                    key={tab.slug}
                    type="button"
                    onClick={() => setCategory?.(tab.slug)}
                    className={cn(
                      'shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-150',
                      active
                        ? 'border-[#006666] bg-[#006666] text-white shadow-[0_4px_12px_rgba(0,102,102,0.28)]'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-teal-300',
                    )}
                  >
                    {getCategoryName(tab.slug, language, tab.name)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Location */}
          <div className="mb-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              {language === 'ru' ? 'Локация' : 'Location'}
            </p>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-left text-sm text-slate-700 transition-colors hover:border-teal-300"
              onClick={() => {/* WhereCombobox handles via parent */}}
            >
              <MapPin className="h-4 w-4 shrink-0 text-teal-600" />
              <span className={where && where !== 'all' ? 'text-slate-800 font-medium' : 'text-slate-400'}>
                {whereLabel}
              </span>
              <ChevronDown className="ml-auto h-4 w-4 text-slate-400" />
            </button>
          </div>

          {/* Dates */}
          <div className="mb-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              {language === 'ru' ? 'Даты' : 'Dates'}
            </p>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-left text-sm transition-colors hover:border-teal-300"
            >
              <Calendar className="h-4 w-4 shrink-0 text-teal-600" />
              <span className={dateRange?.checkIn ? 'text-slate-800 font-medium' : 'text-slate-400'}>
                {datesLabel}
              </span>
            </button>
          </div>

          {/* Guests */}
          <div className="mb-6">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              {language === 'ru' ? 'Гости' : 'Guests'}
            </p>
            <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <Users className="h-4 w-4 text-teal-600" />
              <div className="flex flex-1 items-center justify-between">
                <button
                  type="button"
                  onClick={() => setGuests?.(String(Math.max(1, parseInt(guests || '1') - 1)))}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-600 transition-colors hover:border-teal-400 hover:bg-teal-50"
                >
                  −
                </button>
                <span className="text-lg font-bold text-slate-800">{guests || '1'}</span>
                <button
                  type="button"
                  onClick={() => setGuests?.(String(Math.min(20, parseInt(guests || '1') + 1)))}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-600 transition-colors hover:border-teal-400 hover:bg-teal-50"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky footer — Search button */}
        <div className="border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={handleSearch}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#006666] py-4 text-base font-bold text-white shadow-[0_8px_24px_rgba(0,102,102,0.32)] transition-all active:scale-[0.98]"
          >
            <Search className="h-5 w-5" />
            {getUIText('findButton', language)}
          </button>
        </div>
      </div>
    </>
  )
}
