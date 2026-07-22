'use client'

/**
 * Catalog «Все фильтры» — draft SSOT + SearchFiltersShell (ADR-102).
 * Stage 190.6 — Apply CTA «Show N» from draft filters (preview count), not committed page size.
 */

import { useCallback } from 'react'
import { SearchFiltersPanel } from '@/components/search/SearchFiltersPanel'
import {
  SearchFiltersShell,
  SEARCH_FILTERS_SHELL_SELECT_DIALOG_Z,
  SEARCH_FILTERS_SHELL_SELECT_DRAWER_Z,
} from '@/components/search/SearchFiltersShell'
import { useCatalogExtraFiltersDraft } from '@/lib/hooks/use-catalog-extra-filters-draft'
import { useDraftFilterResultCount } from '@/lib/hooks/use-draft-filter-result-count'
import { useIsMobile } from '@/hooks/use-mobile'

export function SearchFiltersDialog({
  open,
  onOpenChange,
  language = 'ru',
  categorySlug = 'all',
  categoryWizardProfile = null,
  extraFilters,
  onExtraFiltersChange,
  listingsSample = [],
  priceHistogram = null,
  /** Baseline when draft === committed (usually meta.available). */
  resultCount = 0,
  /**
   * Build /api/v2/search params for a draft extra-filters snapshot (core filters stay current).
   * @type {((extra: import('@/lib/search/listings-page-url.js').ListingsExtraFilters) => URLSearchParams) | null}
   */
  buildDraftSearchParams = null,
}) {
  const isMobile = useIsMobile()
  const t = (ru, en) => (language === 'ru' ? ru : en)

  const handleCommit = useCallback(
    (next) => {
      onExtraFiltersChange(next)
    },
    [onExtraFiltersChange],
  )

  const { draftExtraFilters, setDraftExtraFilters, applyDraft, resetDraft, discardDraft } =
    useCatalogExtraFiltersDraft({
      committed: extraFilters,
      onCommit: handleCommit,
      open,
    })

  const { count: draftResultCount, loading: draftCountLoading } = useDraftFilterResultCount({
    open,
    committedCount: resultCount,
    draftExtraFilters,
    committedExtraFilters: extraFilters,
    buildSearchParams: buildDraftSearchParams,
  })

  const handleOpenChange = useCallback(
    (nextOpen) => {
      if (!nextOpen) {
        discardDraft()
      }
      onOpenChange(nextOpen)
    },
    [discardDraft, onOpenChange],
  )

  const handleApply = useCallback(() => {
    applyDraft()
    onOpenChange(false)
  }, [applyDraft, onOpenChange])

  const title = t('Все фильтры', 'All filters')
  const resetLabel = t('Сбросить всё', 'Clear all')
  const applyLabel = draftCountLoading
    ? `${t('Показать', 'Show')}…`
    : `${t('Показать', 'Show')} ${draftResultCount} ${t('вариантов', 'results')}`

  return (
    <SearchFiltersShell
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      onReset={resetDraft}
      onApply={handleApply}
      resetLabel={resetLabel}
      applyLabel={applyLabel}
    >
      <SearchFiltersPanel
        values={draftExtraFilters}
        onChange={setDraftExtraFilters}
        language={language}
        categorySlug={categorySlug}
        categoryWizardProfile={categoryWizardProfile}
        listingsSample={listingsSample}
        priceHistogram={priceHistogram}
        selectPortalClassName={
          isMobile ? SEARCH_FILTERS_SHELL_SELECT_DRAWER_Z : SEARCH_FILTERS_SHELL_SELECT_DIALOG_Z
        }
      />
    </SearchFiltersShell>
  )
}
