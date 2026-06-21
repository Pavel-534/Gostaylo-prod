'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import { Home, Bike, Map as MapIcon, Anchor } from 'lucide-react'
import { getCategoryName } from '@/lib/translations'
import { cn } from '@/lib/utils'
import { HOME_CATEGORY_ICONS } from './home-constants'
import { UnifiedSearchBar } from '@/components/search/UnifiedSearchBar'

/**
 * Airy Premium hero: светлый фон, опциональный заголовок (`heroTitle`),
 * category pill-tabs + UnifiedSearchBar variant="hero" в glass-капсуле.
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
  const displayTabs = useMemo(
    () =>
      (categoryTabs || []).filter(
        (tab) => tab && (tab.isActive === true || tab.is_active === true),
      ),
    [categoryTabs],
  )
  const tabsReady = categoryTabs.length > 0

  const cleanTitle = typeof heroTitle === 'string' ? heroTitle.trim() : ''
  const showTitle = cleanTitle.length > 0

  return (
    <section
      data-hero-search
      className="relative isolate z-[40] min-h-[min(600px,82svh)] overflow-visible pt-[calc(var(--app-header-height,64px)+8px)] pb-12"
    >
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
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand/10 via-black/30 to-transparent" />
      </div>

      <div className="relative z-20 mx-auto flex w-full max-w-6xl flex-col items-center px-4 sm:px-6">
        {showTitle ? (
          <h1 className="mb-6 max-w-3xl text-center text-[28px] font-semibold leading-[1.1] tracking-[-0.015em] text-white drop-shadow-md sm:mb-8 sm:text-[40px] lg:text-[44px]">
            {cleanTitle}
          </h1>
        ) : null}

        <div className="relative z-20 w-full rounded-3xl border border-white/35 bg-white/78 p-3 shadow-[0_32px_64px_-15px_rgba(0,102,102,0.14),0_12px_40px_-18px_rgba(0,0,0,0.2)] backdrop-blur-xl backdrop-saturate-150 transition-all duration-300 focus-within:border-brand/35 focus-within:shadow-[0_32px_64px_-15px_rgba(0,102,102,0.18),0_0_0_3px_rgba(0,102,102,0.12)] sm:p-4">
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
            {!tabsReady
              ? Array.from({ length: 3 }).map((_, idx) => (
                  <div
                    key={`hero-cat-skeleton-${idx}`}
                    className="h-10 w-28 animate-pulse rounded-2xl border border-slate-200/90 bg-white/70"
                    aria-hidden
                  />
                ))
              : null}
          </div>

          <UnifiedSearchBar
            variant="hero"
            language={language}
            category={category}
            where={where}
            setWhere={setWhere}
            dateRange={dateRange}
            setDateRange={setDateRange}
            guests={guests}
            setGuests={setGuests}
            guestsBreakdown={guestsBreakdown}
            setGuestsBreakdown={setGuestsBreakdown}
            onSearch={onSearch}
            textQuery={textQuery}
            setTextQuery={setTextQuery}
            smartSearchOn={smartSearchOn}
            setSmartSearchOn={setSmartSearchOn}
            semanticSearchFeatureEnabled={semanticSearchFeatureEnabled}
            onSearchSubmit={onSearchSubmit}
            liveCount={liveCount}
            countLoading={countLoading}
          />
        </div>
      </div>
    </section>
  )
}

export { Home, Bike, MapIcon, Anchor }
