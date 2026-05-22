'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Search, Sparkles, Home, Bike, Map as MapIcon, Anchor, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchCalendar } from '@/components/search-calendar'
import { WhereCombobox } from '@/components/search/WhereCombobox'
import { GuestsPopover } from '@/components/search/GuestsPopover'
import { getUIText, getCategoryName } from '@/lib/translations'
import { buildWhereOptions } from '@/lib/locations/where-options'
import { getStaticLocationsSeed } from '@/lib/locations/locations-seed'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { HOME_CATEGORY_ICONS } from './home-constants'
import { fetchSearchLocations } from '@/lib/api/catalog-public-client'

/**
 * Базовый стиль 60-px поля (Apple/Airbnb-уровень).
 * Все 4 элемента ряда (Where / Dates / Guests / CTA) используют ту же высоту, тот же
 * `rounded-2xl`, deлiкатный `slate-200` бордер и одинаковый focus-ring (Teal `brand`).
 */
const FIELD_BASE_CLASS =
  'flex h-[60px] w-full min-h-[60px] max-h-[60px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-0 text-left text-base font-medium leading-none text-slate-900 transition-all duration-200 hover:border-slate-300 hover:bg-white focus-within:border-brand focus-within:shadow-[0_0_0_3px_rgba(0,102,102,0.12)] focus-visible:border-brand focus-visible:shadow-[0_0_0_3px_rgba(0,102,102,0.12)] focus-visible:outline-none'

/**
 * Airy Premium hero: светлый фон, опциональный заголовок (`heroTitle`),
 * крупные читаемые поля поиска и контрастные таб-«пилюли» с иконками.
 *
 * @param {string | null} heroTitle — уже разрезолвленный заголовок (env / AUTO → перевод). `null` → блок скрыт.
 */
export function HomeHeroLuxe({
  language,
  categoryTabs = [],
  category,
  setCategory,
  where,
  setWhere,
  dateRange,
  setDateRange,
  guests,
  setGuests,
  guestsBreakdown = null,
  setGuestsBreakdown,
  onSearch,
  textQuery = '',
  setTextQuery,
  smartSearchOn = true,
  setSmartSearchOn,
  semanticSearchFeatureEnabled = true,
  onSearchSubmit,
  liveCount = null,
  countLoading = false,
  heroTitle = null,
  onCategoryTabClick,
}) {
  const [locations, setLocations] = useState(getStaticLocationsSeed)
  const [locationsLoading, setLocationsLoading] = useState(true)

  useEffect(() => {
    fetchSearchLocations()
      .then(({ ok, locations }) => {
        if (ok) setLocations(locations)
      })
      .catch(() => {})
      .finally(() => setLocationsLoading(false))
  }, [])

  const whereOptionsFull = useMemo(() => buildWhereOptions(locations, language), [locations, language])

  const displayTabs = useMemo(
    () =>
      (categoryTabs || []).filter(
        (tab) => tab && (tab.isActive === true || tab.is_active === true),
      ),
    [categoryTabs],
  )
  const tabsReady = categoryTabs.length > 0

  const handleSearchClick = () => {
    onSearchSubmit?.()
    onSearch?.()
  }

  const cleanTitle = typeof heroTitle === 'string' ? heroTitle.trim() : ''
  const showTitle = cleanTitle.length > 0

  return (
    <section
      data-hero-search
      className="relative isolate z-[40] min-h-[min(600px,82svh)] overflow-visible pt-[calc(var(--app-header-height,64px)+8px)] pb-12"
    >
      {/*
        Фон hero: чёткое фото (без blur на оверлее) + лёгкое затемнение + радиальный «тил»-градиент.
        Нижний слой — плавное растворение в белый (`TopListingsGrid`), ~80–120px.
      */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          maskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)',
        }}
        aria-hidden
      >
        <Image
          src="/images/home-hero-nature-luxe.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/50" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-900/10 via-black/30 to-transparent" />
      </div>

      <div className="relative z-20 mx-auto flex w-full max-w-6xl flex-col items-center px-4 sm:px-6">
        {showTitle ? (
          <h1 className="mb-6 max-w-3xl text-center text-[28px] font-semibold leading-[1.1] tracking-[-0.015em] text-white drop-shadow-md sm:mb-8 sm:text-[40px] lg:text-[44px]">
            {cleanTitle}
          </h1>
        ) : null}

        {/* Search capsule — glass на фото (rounded-3xl SSOT внешней капсулы) */}
        <div className="relative z-20 w-full rounded-3xl border border-white/35 bg-white/78 p-3 shadow-[0_32px_64px_-15px_rgba(0,102,102,0.14),0_12px_40px_-18px_rgba(0,0,0,0.2)] backdrop-blur-xl backdrop-saturate-150 transition-all duration-300 focus-within:border-brand/35 focus-within:shadow-[0_32px_64px_-15px_rgba(0,102,102,0.18),0_0_0_3px_rgba(0,102,102,0.12)] sm:p-4">
          {/* Category tabs — pill buttons */}
          <div className="mb-3 flex flex-wrap items-center gap-2 sm:mb-4">
            {displayTabs.map((tab) => {
              const active = category === tab.slug
              const Icon = HOME_CATEGORY_ICONS[tab.slug] || Home
              const comingSoon = tab.isComingSoon === true
              const previewOnly = tab.isPreview === true
              return (
                <button
                  key={tab.slug}
                  type="button"
                  onClick={() => {
                    if (typeof onCategoryTabClick === 'function') {
                      onCategoryTabClick(tab)
                      return
                    }
                    setCategory?.(tab.slug)
                  }}
                  aria-pressed={active}
                  className={cn(
                    'inline-flex h-10 items-center gap-2 rounded-2xl border px-4 text-sm font-semibold tracking-tight transition-all duration-200',
                    active
                      ? 'border-brand bg-brand text-white shadow-[0_8px_22px_-6px_rgba(0,102,102,0.55)]'
                      : 'border-slate-200/90 bg-white/95 text-slate-700 hover:border-brand/60 hover:text-brand',
                    previewOnly && 'opacity-50',
                    !tabsReady && 'animate-pulse opacity-60',
                  )}
                >
                  <Icon className={cn('h-4 w-4', active ? 'text-white' : 'text-brand')} />
                  {getCategoryName(tab.slug, language, tab.name)}
                  {comingSoon ? (
                    <span
                      className={cn(
                        'rounded-full border px-1.5 py-0.5 text-[10px] leading-none',
                        active ? 'border-white/70 text-white' : 'border-amber-300 bg-amber-50 text-amber-700',
                      )}
                    >
                      {language === 'ru' ? 'Скоро' : 'Soon'}
                    </span>
                  ) : null}
                </button>
              )
            })}
            {!tabsReady ? (
              Array.from({ length: 3 }).map((_, idx) => (
                <div
                  key={`hero-cat-skeleton-${idx}`}
                  className="h-10 w-28 animate-pulse rounded-2xl border border-slate-200/90 bg-white/70"
                  aria-hidden
                />
              ))
            ) : null}
          </div>

          {/* Keyword row — то же 60px, slate-900 текст */}
          <div className="mb-3 flex h-[60px] min-h-[60px] max-h-[60px] items-center gap-2 rounded-2xl border border-slate-200/90 bg-white/90 pl-3 pr-2 backdrop-blur-sm">
            <button
              type="button"
              onClick={handleSearchClick}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:border-teal-400 hover:bg-teal-50 hover:text-teal-700"
              aria-label={getUIText('findButton', language)}
            >
              <Search className="h-4 w-4" />
            </button>
            <Input
              type="search"
              value={textQuery}
              onChange={(e) => setTextQuery?.(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSearchClick()
                }
              }}
              placeholder={getUIText('catalogTextSearchPlaceholder', language)}
              className="h-full min-h-0 min-w-0 flex-1 border-0 bg-transparent text-base font-medium leading-none text-slate-900 placeholder:text-slate-500 shadow-none focus-visible:ring-0"
              aria-label={getUIText('catalogTextSearchPlaceholder', language)}
            />
            <button
              type="button"
              disabled={!semanticSearchFeatureEnabled}
              aria-pressed={smartSearchOn && semanticSearchFeatureEnabled}
              onClick={() => {
                if (!semanticSearchFeatureEnabled || !setSmartSearchOn) return
                const next = !smartSearchOn
                setSmartSearchOn(next)
                try {
                  localStorage.setItem('gostaylo_smart_search', next ? '1' : '0')
                } catch {
                  /* ignore */
                }
              }}
              className={cn(
                'flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 transition-colors',
                !semanticSearchFeatureEnabled
                  ? 'cursor-not-allowed opacity-50'
                  : smartSearchOn
                    ? 'border-violet-300 bg-violet-50 text-violet-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
              )}
            >
              <Sparkles className="h-4 w-4 shrink-0" />
              <span className="text-xs font-semibold tracking-tight">
                {language === 'ru' ? 'ИИ' : 'Smart'}
              </span>
            </button>
          </div>

          {/* Strict 60-px row: Where / Dates / Guests / Search CTA */}
          <div className="grid grid-cols-1 items-stretch gap-2 overflow-visible md:grid-cols-[minmax(190px,1.4fr)_minmax(170px,1.2fr)_minmax(170px,0.95fr)_minmax(132px,0.72fr)] xl:grid-cols-[minmax(240px,1.5fr)_minmax(220px,1.3fr)_220px_148px]">
            {/* Where — outer = field-box без padding; flat-вариант сам кладёт px-5 на flex-row */}
            <WhereCombobox
              options={whereOptionsFull}
              value={where || 'all'}
              onChange={setWhere}
              placeholder={getUIText('wherePlaceholder', language)}
              loading={locationsLoading}
              variant="flat"
              language={language}
              className={cn(FIELD_BASE_CLASS, 'px-0')}
            />

            {/* Dates — trigger SearchCalendar становится самим полем */}
            <SearchCalendar
              value={dateRange}
              onChange={setDateRange}
              locale={language}
              placeholder={getUIText('dates', language)}
              liveCount={liveCount}
              countLoading={countLoading}
              className={cn(FIELD_BASE_CLASS, 'cursor-pointer')}
            />

            {/* Guests (SSOT Airbnb-style popover) */}
            <GuestsPopover
              language={language}
              guests={guests}
              setGuests={setGuests}
              guestsBreakdown={guestsBreakdown}
              setGuestsBreakdown={setGuestsBreakdown}
              align="start"
              triggerClassName={cn(FIELD_BASE_CLASS, 'w-full min-w-0 max-w-full xl:min-w-[220px] xl:max-w-[220px] cursor-pointer')}
            />

            {/* Search CTA — тот же h-[60px], тот же rounded-2xl */}
            <Button
              onClick={handleSearchClick}
              className="!h-[60px] min-h-[60px] max-h-[60px] min-w-[148px] shrink-0 rounded-2xl bg-brand px-6 text-base font-semibold leading-none text-white shadow-[0_14px_28px_-8px_rgba(0,102,102,0.42)] transition-all hover:bg-brand-hover hover:shadow-[0_18px_36px_-8px_rgba(0,102,102,0.50)] active:scale-[0.98]"
            >
              <Search className="mr-2 h-5 w-5" />
              {getUIText('findButton', language)}
            </Button>
          </div>

          {/* Hint — деликатная подсказка под рядом, не ломает геометрию */}
          {!dateRange?.from ? (
            <p className="mt-3 hidden items-center gap-1.5 px-1 text-xs text-white/75 md:flex">
              <Calendar className="h-3.5 w-3.5 text-white/70" aria-hidden />
              {language === 'ru'
                ? 'Выберите даты, чтобы увидеть точные цены и доступность'
                : 'Pick dates to see live pricing and availability'}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}

/** Сохраняем re-export иконок, если кто-то импортировал их отсюда. */
export { Home, Bike, MapIcon, Anchor }
