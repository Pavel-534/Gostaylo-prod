'use client'

/**
 * Stage 179.1 — horizontal category chips on home hero only; mobile sheet keeps compact 2×2 Select grid.
 * SSOT tabs: selectHeroCategoryTabs(categories); state via setCategory (usePublicSearchFilters).
 */

import { useMemo } from 'react'
import { Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getCategoryName, getUIText } from '@/lib/translations'
import { selectHeroCategoryTabs } from '@/lib/home/hero-category-tabs'
import { chipIconForCategory } from '@/components/search/category-chip-icon'

/**
 * @param {'hero' | 'sheet'} [variant]
 * @param {Array<Record<string, unknown>>} [categories]
 * @param {Array<Record<string, unknown>>} [tabs] — override tab list (optional)
 */
export function CategoryQuickChips({
  language = 'ru',
  category = 'all',
  setCategory,
  categories = [],
  tabs: tabsProp,
  onCategoryTabClick,
  variant = 'sheet',
  showAllChip = true,
  tabsReady = true,
  className,
}) {
  const tabs = useMemo(
    () => (Array.isArray(tabsProp) && tabsProp.length > 0 ? tabsProp : selectHeroCategoryTabs(categories)),
    [tabsProp, categories],
  )

  const isHero = variant === 'hero'

  const handleSelect = (slug) => {
    setCategory?.(slug)
  }

  const handleTabClick = (tab) => {
    if (typeof onCategoryTabClick === 'function') {
      onCategoryTabClick(tab)
      return
    }
    if (tab?.isComingSoon === true) return
    if (tab?.slug) handleSelect(tab.slug)
  }

  return (
    <div className={cn('min-w-0', className)} data-testid="category-quick-chips">
      {!isHero ? (
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
          {getUIText('whatPlaceholder', language)}
        </p>
      ) : null}

      <div
        className={cn(
          'flex gap-2',
          isHero ? 'flex-wrap items-center' : '-mx-0.5 overflow-x-auto px-0.5 pb-0.5 scrollbar-none',
        )}
        role="list"
      >
        {showAllChip && !isHero ? (
          <button
            type="button"
            role="listitem"
            onClick={() => handleSelect('all')}
            data-testid="category-quick-chip-all"
            className={cn(
              'shrink-0 inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-all duration-150 active:scale-95',
              !category || category === 'all'
                ? 'border-brand bg-brand/10 text-brand-hover'
                : 'border-slate-200 bg-white text-slate-700 hover:border-brand/30',
            )}
          >
            <Layers className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
            {getUIText('allLabel', language)}
          </button>
        ) : null}

        {!tabsReady
          ? Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={`cat-chip-skeleton-${idx}`}
                className={cn(
                  'animate-pulse rounded-2xl border border-slate-200/90 bg-slate-100',
                  isHero ? 'h-10 w-28' : 'h-11 w-24 shrink-0 rounded-full',
                )}
                aria-hidden
              />
            ))
          : tabs.map((tab) => {
              const active = category === tab.slug
              const Icon = chipIconForCategory(tab)
              const comingSoon = tab.isComingSoon === true
              const previewOnly = tab.isPreview === true
              const label = getCategoryName(tab.slug, language, tab.name)

              return (
                <button
                  key={tab.slug}
                  type="button"
                  role="listitem"
                  aria-pressed={active}
                  onClick={() => handleTabClick(tab)}
                  data-testid={`category-quick-chip-${tab.slug}`}
                  className={cn(
                    'inline-flex items-center gap-1.5 font-semibold transition-all duration-150 active:scale-95',
                    isHero
                      ? cn(
                          'h-10 rounded-2xl border px-4 text-sm tracking-tight',
                          active
                            ? 'border-brand bg-brand text-white shadow-[0_8px_22px_-6px_rgba(0,102,102,0.55)]'
                            : 'border-slate-200/90 bg-white/95 text-slate-700 hover:border-brand/60 hover:text-brand',
                          previewOnly && 'opacity-50',
                        )
                      : cn(
                          'min-h-11 shrink-0 rounded-full border px-3 py-2 text-xs',
                          active
                            ? 'border-brand bg-brand/10 text-brand-hover'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-brand/30',
                        ),
                  )}
                >
                  <Icon
                    className={cn(
                      'shrink-0',
                      isHero ? 'h-4 w-4' : 'h-3.5 w-3.5',
                      isHero && active ? 'text-white' : 'text-brand',
                    )}
                    aria-hidden
                  />
                  <span className="truncate">{label}</span>
                  {comingSoon ? (
                    <span
                      className={cn(
                        'rounded-full border px-1.5 py-0.5 text-[10px] leading-none',
                        isHero && active
                          ? 'border-white/70 text-white'
                          : 'border-amber-300 bg-amber-50 text-amber-700',
                      )}
                    >
                      {language === 'ru' ? 'Скоро' : 'Soon'}
                    </span>
                  ) : null}
                </button>
              )
            })}
      </div>
    </div>
  )
}
