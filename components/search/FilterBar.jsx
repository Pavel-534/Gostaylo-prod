/**
 * FilterBar - What | Where | When | Who + «Фильтры» (модалка)
 */

'use client';

import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Users, CalendarIcon, X, Layers, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { chipIconForCategory } from '@/components/search/category-chip-icon';
import {
  buildChildrenByParentId,
  getCategoryBySlug,
} from '@/lib/config/category-hierarchy';
import { formatDisplayDate } from '@/lib/date-display-format';
import { getUIText, getCategoryName } from '@/lib/translations';
import { pluralizeGuests } from '@/lib/i18n/pluralize';
import { UnifiedSearchBar } from '@/components/search/UnifiedSearchBar';
import { SearchFiltersDialog } from '@/components/search/SearchFiltersDialog';

export function FilterBar({
  language = 'en',
  dateRange,
  setDateRange,
  checkInTime = '07:00',
  setCheckInTime,
  checkOutTime = '07:00',
  setCheckOutTime,
  selectedCategory,
  /** Stage 67.0 — `categories.wizard_profile` для выбранной категории (из /api/v2/categories) */
  selectedCategoryWizardProfile = null,
  /** Stage 68.0 — полный список категорий с `parentId` (чипы подкатегорий) */
  categoriesForHierarchy = [],
  setSelectedCategory,
  where,
  setWhere,
  guests,
  setGuests,
  guestsBreakdown = null,
  setGuestsBreakdown,
  clearDates,
  nights = 0,
  extraFilters,
  onExtraFiltersChange,
  listingsForFiltersHistogram = [],
  priceHistogram = null,
  filterResultCount = 0,
  textQuery = '',
  setTextQuery,
  smartSearchOn = true,
  setSmartSearchOn,
  semanticSearchFeatureEnabled = true,
  /** Лупа / Enter в строке текста: полный поиск с ИИ (если включён) */
  onSearchSubmit,
  /** Stage 69.0 — заголовок блока результатов (родитель vs подкатегория) */
  catalogHeadline = null,
  catalogSubline = null,
  /** Stage 69.1 — текст из `categories.description` под заголовком при выборе родительской категории */
  catalogParentBlurb = null,
  /** ADR-101 — when false, outer sticky shell is owned by PublicSearchChrome */
  shellWrapper = true,
  filtersOpen: filtersOpenProp,
  onFiltersOpenChange,
}) {
  const [filtersOpenInternal, setFiltersOpenInternal] = useState(false);
  const filtersOpen = filtersOpenProp ?? filtersOpenInternal;
  const setFiltersOpen = onFiltersOpenChange ?? setFiltersOpenInternal;

  const currentCategoryObj = useMemo(
    () => getCategoryBySlug(categoriesForHierarchy, selectedCategory),
    [categoriesForHierarchy, selectedCategory],
  );

  const childrenByParent = useMemo(
    () => buildChildrenByParentId(categoriesForHierarchy),
    [categoriesForHierarchy],
  );

  const subcategoryChips = useMemo(() => {
    if (!currentCategoryObj?.id) return [];
    return childrenByParent.get(String(currentCategoryObj.id)) || [];
  }, [currentCategoryObj, childrenByParent]);

  const parentCategoryObj = useMemo(() => {
    if (!currentCategoryObj) return null;
    const pid = currentCategoryObj.parentId ?? currentCategoryObj.parent_id;
    if (!pid) return null;
    return (categoriesForHierarchy || []).find((c) => String(c.id) === String(pid)) || null;
  }, [currentCategoryObj, categoriesForHierarchy]);

  const CategoryBadgeIcon = useMemo(() => {
    if (!selectedCategory || selectedCategory === 'all') return Layers;
    const merged = currentCategoryObj
      ? {
          ...currentCategoryObj,
          wizardProfile:
            selectedCategoryWizardProfile ??
            currentCategoryObj.wizardProfile ??
            currentCategoryObj.wizard_profile,
        }
      : { slug: selectedCategory, wizardProfile: selectedCategoryWizardProfile };
    return chipIconForCategory(merged);
  }, [selectedCategory, currentCategoryObj, selectedCategoryWizardProfile]);

  const showRefineRow = subcategoryChips.length > 0 || parentCategoryObj;

  const hasActiveFilterBadges =
    (dateRange.from && dateRange.to) ||
    (selectedCategory && selectedCategory !== 'all') ||
    (where && where !== 'all') ||
    guests !== '1';

  const filterBody = (
    <div className="border-b border-slate-200 bg-white">
      <div className="container mx-auto px-4 py-3">
        <h1 className="sr-only">
          {catalogHeadline || getUIText('searchResults', language)}
          {catalogSubline ? ` — ${catalogSubline}` : ''}
        </h1>
        {hasActiveFilterBadges ? (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {selectedCategory && selectedCategory !== 'all' && (
              <Badge variant="secondary" className="border-brand/20 bg-brand/5 text-brand-hover">
                <CategoryBadgeIcon className="h-4 w-4 mr-1" />
                {getCategoryName(selectedCategory, language) || selectedCategory}
              </Badge>
            )}
            {dateRange.from && dateRange.to ? (
              <Badge variant="secondary" className="flex items-center gap-2 border-slate-200 bg-slate-50 px-3 py-1">
                <CalendarIcon className="h-4 w-4 text-brand" />
                {formatDisplayDate(dateRange.from)} — {formatDisplayDate(dateRange.to)}
                <span className="text-slate-500">
                  ({nights} {getUIText('nightShort', language)})
                </span>
                <button type="button" onClick={clearDates} className="ml-1 hover:text-red-600">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ) : null}
            {guests !== '1' ? (
              <Badge variant="secondary" className="border-slate-200 bg-slate-50">
                <Users className="h-4 w-4 mr-1 text-brand" />
                {guests} {pluralizeGuests(guests, language)}
              </Badge>
            ) : null}
            {where && where !== 'all' ? (
              <Badge variant="secondary" className="border-slate-200 bg-slate-50">
                <MapPin className="h-4 w-4 mr-1 text-brand" />
                {where}
              </Badge>
            ) : null}
          </div>
        ) : null}
        {catalogSubline ? (
          <p className="mb-2 text-sm font-medium text-slate-600">{catalogSubline}</p>
        ) : null}
        {catalogParentBlurb ? (
          <p className="mb-2 max-w-3xl text-sm leading-relaxed text-slate-500">{catalogParentBlurb}</p>
        ) : null}
        <div className="flex flex-col gap-2 md:flex-row md:items-stretch md:gap-3">
          <div className="min-w-0 flex-1">
            <UnifiedSearchBar
              variant="filter"
              language={language}
              category={selectedCategory}
              categoryWizardProfile={selectedCategoryWizardProfile}
              setCategory={setSelectedCategory}
              where={where}
              setWhere={setWhere}
              dateRange={dateRange}
              setDateRange={setDateRange}
              checkInTime={checkInTime}
              setCheckInTime={setCheckInTime}
              checkOutTime={checkOutTime}
              setCheckOutTime={setCheckOutTime}
              guests={guests}
              setGuests={setGuests}
              guestsBreakdown={guestsBreakdown}
              setGuestsBreakdown={setGuestsBreakdown}
              textQuery={textQuery}
              setTextQuery={setTextQuery}
              smartSearchOn={smartSearchOn}
              setSmartSearchOn={setSmartSearchOn}
              semanticSearchFeatureEnabled={semanticSearchFeatureEnabled}
              onSearchSubmit={onSearchSubmit}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-[36px] shrink-0 border-slate-300 px-4 md:self-stretch md:py-0"
            onClick={() => setFiltersOpen(true)}
            data-testid="search-filters-button"
          >
            <SlidersHorizontal className="mr-2 h-4 w-4 text-brand" />
            {getUIText('filtersBtn', language)}
          </Button>
        </div>
        {showRefineRow ? (
          <div className="border-t border-slate-100 bg-slate-50/95 py-3">
            <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-2 px-4">
              {parentCategoryObj ? (
                <button
                  type="button"
                  onClick={() => setSelectedCategory?.(parentCategoryObj.slug)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-brand/40 hover:text-brand-hover"
                >
                  <span className="text-slate-500">←</span>
                  <span>
                    {getUIText('groupBackTo', language)}
                    <span className="font-semibold text-slate-900">
                      {getCategoryName(parentCategoryObj.slug, language) || parentCategoryObj.name}
                    </span>
                  </span>
                </button>
              ) : null}
              {subcategoryChips.map((child) => {
                const Icon = chipIconForCategory(child);
                const active =
                  String(selectedCategory || '').toLowerCase() === String(child.slug || '').toLowerCase();
                return (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => setSelectedCategory?.(child.slug)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                      active
                        ? 'border-brand bg-brand/10 text-brand'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-brand/30',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
                    {getCategoryName(child.slug, language) || child.name}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <>
      {shellWrapper ? (
        <div className="sticky app-sticky-below-header z-20">{filterBody}</div>
      ) : (
        filterBody
      )}

      {extraFilters != null && onExtraFiltersChange != null ? (
        <SearchFiltersDialog
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          language={language}
          categorySlug={selectedCategory}
          categoryWizardProfile={selectedCategoryWizardProfile}
          extraFilters={extraFilters}
          onExtraFiltersChange={onExtraFiltersChange}
          listingsSample={listingsForFiltersHistogram}
          priceHistogram={priceHistogram}
          resultCount={filterResultCount}
        />
      ) : null}
    </>
  );
}
