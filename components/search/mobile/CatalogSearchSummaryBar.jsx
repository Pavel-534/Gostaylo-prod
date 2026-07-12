'use client'

/**
 * Stage 178.3 Step 1 — mobile catalog search informer (read-only).
 * Replaces in-flow FilterBar on `<md`; tap opens CatalogMobileSearchSheet.
 */

import { useMemo } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { getUIText } from '@/lib/translations'
import { chipIconForCategory } from '@/components/search/category-chip-icon'
import {
  buildCatalogSearchSummaryLabels,
  resolveCatalogSearchCategoryIconSource,
} from '@/lib/search/catalog-search-summary-labels'
import { cn } from '@/lib/utils'

export function CatalogSearchSummaryBar({
  language = 'ru',
  category = 'all',
  categoryWizardProfile = null,
  categoriesForHierarchy = [],
  where = 'all',
  dateRange,
  guests = '1',
  guestsBreakdown = null,
  textQuery = '',
  catalogHeadline = null,
  catalogSubline = null,
  onOpenSearch,
  className,
}) {
  const { segments } = useMemo(
    () =>
      buildCatalogSearchSummaryLabels({
        language,
        category,
        where,
        dateRange,
        guests,
        guestsBreakdown,
        categoriesForHierarchy,
      }),
    [language, category, where, dateRange, guests, guestsBreakdown, categoriesForHierarchy],
  )

  const CategoryIcon = useMemo(() => {
    const src = resolveCatalogSearchCategoryIconSource(
      category,
      categoryWizardProfile,
      categoriesForHierarchy,
    )
    return chipIconForCategory(src)
  }, [category, categoryWizardProfile, categoriesForHierarchy])

  const summaryLine = segments.join(' · ')
  const trimmedQuery = String(textQuery || '').trim()
  const displayLine = trimmedQuery ? `${summaryLine} · “${trimmedQuery}”` : summaryLine

  const openLabel = getUIText('catalogSearchSummary_openSearch', language)

  return (
    <div
      className={cn(
        'sticky top-[var(--app-header-height,64px)] z-[90] border-b border-slate-200/90 gsl-premium-glass',
        className,
      )}
      data-testid="catalog-search-summary-bar"
    >
      <h1 className="sr-only">
        {catalogHeadline || getUIText('searchResults', language)}
        {catalogSubline ? ` — ${catalogSubline}` : ''}
      </h1>

      <div className="container mx-auto px-3 py-2">
        <button
          type="button"
          role="button"
          onClick={onOpenSearch}
          aria-label={openLabel}
          data-testid="catalog-search-summary-open"
          className={cn(
            'flex w-full min-h-[52px] max-h-14 items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-3 py-2.5',
            'text-left shadow-sm transition-colors',
            'hover:border-brand/30 hover:bg-brand/[0.03] active:scale-[0.99]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 focus-visible:ring-offset-2',
          )}
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand"
            aria-hidden
          >
            <CategoryIcon className="h-[18px] w-[18px]" />
          </span>

          <span className="min-w-0 flex-1 truncate text-sm font-semibold leading-snug text-slate-900">
            {displayLine}
          </span>

          <Search className="h-4 w-4 shrink-0 text-brand/80" aria-hidden />
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        </button>
      </div>
    </div>
  )
}
