'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUIText } from '@/lib/translations'
import { CategoryQuickChips } from '@/components/search/mobile/CategoryQuickChips'
import { UnifiedSearchBar } from '@/components/search/UnifiedSearchBar'
import { buildCatalogSearchSummaryLabels } from '@/lib/search/catalog-search-summary-labels'

/**
 * Airy Premium hero: светлый фон, опциональный заголовок (`heroTitle`),
 * category pill-tabs + UnifiedSearchBar variant="hero" в glass-капсуле.
 * Stage 191.0 — mobile `<md`: collapsed Airbnb-like search pill → sheet (no full form on hero).
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
  /** Stage 191.0 — opens CatalogMobileSearchSheet on mobile. */
  onOpenMobileSearch,
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

  const mobilePillLine = useMemo(() => {
    const { segments } = buildCatalogSearchSummaryLabels({
      language,
      category,
      where,
      dateRange,
      guests,
      guestsBreakdown,
    })
    const base = segments.join(' · ')
    const q = String(textQuery || '').trim()
    if (q) return `${base} · “${q}”`
    if (base && base !== getUIText('whereShort', language)) return base
    return getUIText('wherePlaceholder', language)
  }, [language, category, where, dateRange, guests, guestsBreakdown, textQuery])

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

        {/* Mobile: collapsed search pill (Stage 191.0) */}
        <div className="relative z-20 w-full max-w-xl md:hidden" data-testid="home-mobile-search-pill-wrap">
          <CategoryQuickChips
            variant="hero"
            language={language}
            category={category}
            setCategory={setCategory}
            tabs={displayTabs}
            tabsReady={tabsReady}
            showAllChip={false}
            onCategoryTabClick={onCategoryTabClick}
            className="mb-3"
          />
          <button
            type="button"
            onClick={() => onOpenMobileSearch?.()}
            aria-label={getUIText('findButton', language)}
            data-testid="home-mobile-search-pill"
            className={cn(
              'flex w-full min-h-14 items-center gap-3 rounded-full border border-white/50 bg-white/92 px-4 py-3 text-left shadow-[0_12px_40px_-12px_rgba(0,0,0,0.35)] backdrop-blur-md',
              'transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
            )}
          >
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-sm">
              <Search className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-slate-900">
                {getUIText('findButton', language)}
              </span>
              <span className="mt-0.5 block truncate text-xs text-slate-500">{mobilePillLine}</span>
            </span>
          </button>
        </div>

        {/* Desktop / tablet: full glass capsule */}
        <div
          data-public-search-chrome-expanded
          className="relative z-20 mt-0 hidden w-full rounded-3xl border border-white/35 bg-white/78 p-3 shadow-[0_32px_64px_-15px_rgba(0,102,102,0.14),0_12px_40px_-18px_rgba(0,0,0,0.2)] backdrop-blur-xl backdrop-saturate-150 transition-all duration-300 focus-within:border-brand/35 focus-within:shadow-[0_32px_64px_-15px_rgba(0,102,102,0.18),0_0_0_3px_rgba(0,102,102,0.12)] sm:p-4 md:block"
        >
          <CategoryQuickChips
            variant="hero"
            language={language}
            category={category}
            setCategory={setCategory}
            tabs={displayTabs}
            tabsReady={tabsReady}
            showAllChip={false}
            onCategoryTabClick={onCategoryTabClick}
            className="mb-3 sm:mb-4"
          />

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
