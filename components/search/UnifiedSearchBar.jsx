'use client'

/**
 * UnifiedSearchBar — ADR-101 Wave 3 UI-SSOT for public search fields (What/Where/When/Who).
 *
 * variant:
 * - hero: premium 60px row (HomeHeroLuxe capsule — no outer shell)
 * - filter: catalog expanded grid + text search row
 * - compact: fixed chrome single row + summary chips (home + catalog scroll)
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Search,
  Layers,
  MapPin,
  Sparkles,
  Users,
  Calendar,
  X,
  SlidersHorizontal,
} from 'lucide-react'
import { format, isSameDay } from 'date-fns'
import { ru as ruLocale } from 'date-fns/locale'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { SearchCalendar } from '@/components/search-calendar'
import { WhereCombobox } from '@/components/search/WhereCombobox'
import { GuestsPopover, formatGuestsSummaryText } from '@/components/search/GuestsPopover'
import { TimeSelect } from '@/components/ui/time-select'
import { getUIText, getCategoryName } from '@/lib/translations'
import { buildWhereOptions } from '@/lib/locations/where-options'
import { getStaticLocationsSeed } from '@/lib/locations/locations-seed'
import { cn } from '@/lib/utils'
import { isTransportIntervalWizardProfile } from '@/lib/config/category-wizard-profile-db'
import { orderedCategoriesForSearchUi, effectiveCategoryWizardProfileRaw } from '@/lib/config/category-hierarchy'
import { fetchCategories } from '@/lib/client-data'
import { fetchLocationSuggest } from '@/lib/api/catalog-public-client'

/** Premium hero field — 60px, rounded-2xl, brand focus ring (Stage 79.2+) */
export const UNIFIED_SEARCH_HERO_FIELD_CLASS =
  'flex h-[60px] w-full min-h-[60px] max-h-[60px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-0 text-left text-base font-medium leading-none text-slate-900 transition-all duration-200 hover:border-slate-300 hover:bg-white focus-within:border-brand focus-within:shadow-[0_0_0_3px_rgba(0,102,102,0.12)] focus-visible:border-brand focus-visible:shadow-[0_0_0_3px_rgba(0,102,102,0.12)] focus-visible:outline-none'

/** Compact chrome inner row */
const COMPACT_INNER_ROW_CLASS =
  'flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm'

function resolveWhereLabel(whereValue, options) {
  if (!whereValue || whereValue === 'all') return null
  const v = String(whereValue).toLowerCase()
  const match = (options || []).find((o) => String(o.value).toLowerCase() === v)
  if (match?.label) return match.label
  return String(whereValue)
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
}

function formatDateRangeShort(dateRange, language) {
  if (!dateRange?.from) return null
  const locale = language === 'ru' ? ruLocale : undefined
  if (!dateRange.to || isSameDay(dateRange.from, dateRange.to)) {
    return format(dateRange.from, language === 'ru' ? 'd MMM' : 'MMM d', { locale })
  }
  const sameMonth = dateRange.from.getMonth() === dateRange.to.getMonth()
  if (sameMonth) {
    const m = format(dateRange.from, language === 'ru' ? 'MMM' : 'MMM', { locale })
    return `${format(dateRange.from, 'd')}–${format(dateRange.to, 'd')} ${m}`
  }
  const mk = (d) => format(d, language === 'ru' ? 'd MMM' : 'MMM d', { locale })
  return `${mk(dateRange.from)} – ${mk(dateRange.to)}`
}

function CompactSummaryChip({ icon: Icon, children, onClick, onClear, testid, clearAriaLabel }) {
  return (
    <span
      className="group inline-flex items-center gap-1.5 rounded-full border border-brand/25 bg-brand/10 pl-2.5 pr-1 py-1 text-xs font-semibold text-brand-hover shadow-sm transition-all hover:border-brand/40 hover:bg-brand/15 hover:shadow"
      data-testid={testid}
    >
      <button type="button" onClick={onClick} className="flex cursor-pointer items-center gap-1.5 focus:outline-none">
        <Icon className="h-3 w-3 text-brand" aria-hidden />
        <span>{children}</span>
      </button>
      <button
        type="button"
        onClick={onClear}
        aria-label={clearAriaLabel}
        className="flex h-5 w-5 items-center justify-center rounded-full text-brand/70 transition-colors hover:bg-brand/20 hover:text-brand"
      >
        <X className="h-3 w-3" aria-hidden />
      </button>
    </span>
  )
}

export function UnifiedSearchBar({
  variant = 'hero',
  language = 'ru',
  category,
  setCategory,
  where,
  setWhere,
  dateRange,
  setDateRange,
  checkInTime = '07:00',
  setCheckInTime,
  checkOutTime = '07:00',
  setCheckOutTime,
  guests,
  setGuests,
  guestsBreakdown = null,
  setGuestsBreakdown,
  onSearch,
  categoryWizardProfile = null,
  textQuery = '',
  setTextQuery,
  smartSearchOn = true,
  setSmartSearchOn,
  semanticSearchFeatureEnabled = true,
  onSearchSubmit,
  liveCount = null,
  countLoading = false,
  clearDates: _clearDates,
  nights: _nights = 0,
  showFiltersButton = false,
  onFiltersClick,
  /** Raised z-index for Radix Select portal inside bottom sheets (e.g. CatalogMobileSearchSheet z-120). */
  categorySelectPortalClassName,
  className,
  innerClassName,
}) {
  const [categories, setCategories] = useState([])
  const locations = useMemo(() => getStaticLocationsSeed(), [])
  const whereRef = useRef(null)
  const datesRef = useRef(null)
  const guestsTriggerRef = useRef(null)

  useEffect(() => {
    if (variant !== 'filter') return
    fetchCategories()
      .then((cats) => setCategories(cats || []))
      .catch(() => {})
  }, [variant])

  const whereOptionsFull = useMemo(
    () => buildWhereOptions(locations, language),
    [locations, language],
  )

  const fetchWhereSuggestions = useCallback(
    async (q) => {
      const res = await fetchLocationSuggest({ q, lang: language, limit: 12 })
      return res.ok ? res.items : []
    },
    [language],
  )

  const handleSearchClick = () => {
    onSearchSubmit?.()
    onSearch?.()
  }

  const showTextSearch = typeof setTextQuery === 'function'

  const transportIntervalMode = useMemo(() => {
    const eff =
      categoryWizardProfile ?? effectiveCategoryWizardProfileRaw(category, categories)
    return isTransportIntervalWizardProfile(eff, category)
  }, [categoryWizardProfile, category, categories])

  const orderedCategoryRows = useMemo(
    () => orderedCategoriesForSearchUi(categories),
    [categories],
  )

  const compactWhereLabel = useMemo(
    () => resolveWhereLabel(where, whereOptionsFull),
    [where, whereOptionsFull],
  )
  const compactDatesLabel = useMemo(
    () => formatDateRangeShort(dateRange, language),
    [dateRange, language],
  )
  const compactGuestsLabel = useMemo(() => {
    const b =
      guestsBreakdown && typeof guestsBreakdown === 'object'
        ? guestsBreakdown
        : { adults: Math.max(1, parseInt(guests, 10) || 1), children: 0, infants: 0 }
    const total = (b.adults || 0) + (b.children || 0) + (b.infants || 0)
    if (!total || total <= 1) return null
    return formatGuestsSummaryText(b, language)
  }, [guests, guestsBreakdown, language])

  const compactCatLabel =
    category && category !== 'all'
      ? getCategoryName(category, language)
      : getUIText('mobileSearchWhatTitle', language)

  const compactHasAnyFilter = Boolean(compactWhereLabel || compactDatesLabel || compactGuestsLabel)

  const focusCompactField = useCallback((ref, opts = {}) => {
    const el = ref?.current
    if (!el) return
    const focusable = el.querySelector('button, input')
    if (focusable) {
      if (focusable.tagName === 'BUTTON') focusable.click()
      if (opts.focus !== false) focusable.focus({ preventScroll: true })
    }
  }, [])

  const textSearchRowFilter = showTextSearch ? (
    <TooltipProvider delayDuration={250}>
      <div
        className={cn(
          'flex min-w-0 items-center gap-2 border-b border-slate-200 bg-slate-50/80 px-3 py-2',
          variant === 'filter' && 'border-t-0 border-x-0 bg-white',
        )}
      >
        <button
          type="button"
          onClick={() => onSearchSubmit?.()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-brand/40 hover:bg-brand/10 hover:text-brand-hover"
          aria-label={getUIText('findButton', language)}
        >
          <Search className="h-4 w-4" aria-hidden />
        </button>
        <Input
          type="search"
          value={textQuery}
          onChange={(e) => setTextQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onSearchSubmit?.()
            }
          }}
          placeholder={getUIText('catalogTextSearchPlaceholder', language)}
          className="h-9 min-w-0 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
          aria-label={getUIText('catalogTextSearchPlaceholder', language)}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled={!semanticSearchFeatureEnabled}
              aria-pressed={smartSearchOn && semanticSearchFeatureEnabled}
              onClick={() => {
                if (!semanticSearchFeatureEnabled || !setSmartSearchOn) return
                setSmartSearchOn(!smartSearchOn)
                try {
                  localStorage.setItem('gostaylo_smart_search', !smartSearchOn ? '1' : '0')
                } catch {
                  /* ignore */
                }
              }}
              className={cn(
                'flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 transition-colors',
                !semanticSearchFeatureEnabled && 'cursor-not-allowed opacity-50',
                semanticSearchFeatureEnabled &&
                  smartSearchOn &&
                  'border-violet-300 bg-violet-50 text-violet-700',
                semanticSearchFeatureEnabled &&
                  !smartSearchOn &&
                  'border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
              )}
            >
              <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
              <span className="text-xs font-semibold tracking-tight">
                {getUIText('aiBadge', language)}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[280px] text-center">
            {semanticSearchFeatureEnabled
              ? getUIText('smartSearchTooltip', language)
              : getUIText('smartSearchDisabledByAdmin', language)}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  ) : null

  if (variant === 'filter') {
    return (
      <div className="flex min-w-0 flex-col overflow-visible rounded-lg border border-slate-200 bg-white shadow-sm">
        {textSearchRowFilter ? (
          <div className="overflow-hidden rounded-t-lg" data-search-section="keywords">
            {textSearchRowFilter}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2 border-t-0 p-2 md:grid-cols-4 md:p-2">
          <div data-search-section="what" className="min-w-0">
            <Select value={category || 'all'} onValueChange={(v) => setCategory?.(v)}>
              <SelectTrigger className="h-9">
                <Layers className="h-4 w-4 mr-2 text-brand" />
                <span className="truncate">
                  {category && category !== 'all'
                    ? getCategoryName(category, language) || category
                    : getUIText('whatPlaceholder', language)}
                </span>
              </SelectTrigger>
              <SelectContent className={categorySelectPortalClassName}>
                <SelectItem value="all">{getUIText('allLabel', language)}</SelectItem>
                {orderedCategoryRows.map(({ cat: c, depth }) => (
                  <SelectItem key={c.id} value={c.slug} className={depth ? 'pl-7' : ''}>
                    {depth ? '· ' : ''}
                    {getCategoryName(c.slug, language) || c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div data-search-section="where" className="min-w-0">
            <WhereCombobox
              options={whereOptionsFull}
              value={where || 'all'}
              onChange={setWhere}
              placeholder={getUIText('whereShort', language)}
              fetchSuggestions={fetchWhereSuggestions}
              loading={false}
              variant="compact"
              language={language}
              className="min-w-0"
            />
          </div>

          <div data-search-section="dates" className="min-w-0 space-y-1">
            <SearchCalendar
              value={dateRange}
              onChange={setDateRange}
              locale={language}
              placeholder={getUIText('dates', language)}
              className="h-9 w-full min-w-0 border rounded-md justify-start px-3"
            />
            {transportIntervalMode && dateRange?.from && dateRange?.to && (
              <div className="grid grid-cols-2 gap-1">
                <TimeSelect value={checkInTime} onChange={setCheckInTime} className="h-8 text-xs" />
                <TimeSelect value={checkOutTime} onChange={setCheckOutTime} className="h-8 text-xs" />
              </div>
            )}
          </div>

          <div data-search-section="guests" className="min-w-0">
            <GuestsPopover
              language={language}
              guests={guests}
              setGuests={setGuests}
              guestsBreakdown={guestsBreakdown}
              setGuestsBreakdown={setGuestsBreakdown}
              align="end"
              triggerClassName="h-9 w-full rounded-md px-3"
            />
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div className={cn('container mx-auto px-4 py-2.5', className)}>
        <div className={cn(COMPACT_INNER_ROW_CLASS, innerClassName)}>
          <div className="hidden min-w-0 shrink-0 items-center gap-1.5 border-r border-slate-100 px-3 md:flex">
            <Layers className="h-4 w-4 shrink-0 text-brand" />
            <span className="max-w-[140px] truncate text-sm font-medium text-slate-700">{compactCatLabel}</span>
          </div>

          <div ref={whereRef} className="min-w-[180px] flex-1 border-r border-slate-100 px-2 xl:min-w-[240px]">
            <WhereCombobox
              options={whereOptionsFull}
              value={where || 'all'}
              onChange={setWhere}
              placeholder={getUIText('wherePlaceholder', language)}
              fetchSuggestions={fetchWhereSuggestions}
              variant="hero"
              language={language}
              className="min-h-[36px] min-w-0 [&_button]:h-auto [&_button]:min-h-[36px] [&_button]:rounded-none [&_button]:border-0 [&_button]:px-0 [&_button]:text-sm [&_button]:shadow-none [&_button]:focus:ring-0"
            />
          </div>

          <div ref={datesRef} className="min-w-[170px] flex-1 border-r border-slate-100 px-2 xl:min-w-[220px]">
            <SearchCalendar
              value={dateRange}
              onChange={setDateRange}
              locale={language}
              placeholder={getUIText('dates', language)}
              className="min-h-[36px] justify-start border-0 px-0 text-sm shadow-none"
            />
          </div>

          <div ref={guestsTriggerRef}>
            <GuestsPopover
              language={language}
              guests={guests}
              setGuests={setGuests}
              guestsBreakdown={guestsBreakdown}
              setGuestsBreakdown={setGuestsBreakdown}
              align="end"
              triggerClassName="h-9 w-[clamp(168px,20vw,220px)] min-w-[168px] max-w-[220px] rounded-lg px-3 text-sm font-medium text-slate-700"
            />
          </div>

          {showFiltersButton ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden h-9 shrink-0 border-slate-300 px-3 md:inline-flex"
              onClick={onFiltersClick}
              data-testid="public-compact-filters-button"
            >
              <SlidersHorizontal className="h-4 w-4 text-brand" />
            </Button>
          ) : null}

          <Button
            onClick={handleSearchClick}
            data-testid="sticky-search-submit"
            className="h-9 rounded-xl bg-brand px-4 text-sm font-semibold text-white shadow-[0_6px_14px_rgba(0,102,102,0.28)] hover:bg-brand-hover"
          >
            <Search className="mr-1.5 h-4 w-4" />
            <span className="hidden sm:inline">{getUIText('findButton', language)}</span>
          </Button>
        </div>

        {compactHasAnyFilter ? (
          <div
            data-testid="public-compact-summary-chips"
            className="mt-2 flex flex-wrap items-center gap-1.5 px-1"
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              {language === 'ru' ? 'Фильтры' : 'Filters'}:
            </span>
            {compactWhereLabel ? (
              <CompactSummaryChip
                icon={MapPin}
                testid="public-compact-chip-where"
                onClick={() => focusCompactField(whereRef)}
                onClear={(e) => {
                  e.stopPropagation()
                  setWhere?.('all')
                }}
                clearAriaLabel={language === 'ru' ? 'Убрать локацию' : 'Clear location'}
              >
                {compactWhereLabel}
              </CompactSummaryChip>
            ) : null}
            {compactDatesLabel ? (
              <CompactSummaryChip
                icon={Calendar}
                testid="public-compact-chip-dates"
                onClick={() => focusCompactField(datesRef)}
                onClear={(e) => {
                  e.stopPropagation()
                  setDateRange?.({ from: undefined, to: undefined })
                }}
                clearAriaLabel={language === 'ru' ? 'Убрать даты' : 'Clear dates'}
              >
                {compactDatesLabel}
              </CompactSummaryChip>
            ) : null}
            {compactGuestsLabel ? (
              <CompactSummaryChip
                icon={Users}
                testid="public-compact-chip-guests"
                onClick={() => guestsTriggerRef.current?.querySelector('button')?.click()}
                onClear={(e) => {
                  e.stopPropagation()
                  setGuests?.('1')
                  setGuestsBreakdown?.({ adults: 1, children: 0, infants: 0 })
                }}
                clearAriaLabel={language === 'ru' ? 'Сбросить гостей' : 'Clear guests'}
              >
                {compactGuestsLabel}
              </CompactSummaryChip>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  // hero — premium 60px fields embedded in HomeHeroLuxe glass capsule
  return (
    <div className={cn('min-w-0', className)}>
      {showTextSearch ? (
        <div className="mb-3 flex h-[60px] min-h-[60px] max-h-[60px] items-center gap-2 rounded-2xl border border-slate-200/90 bg-white/90 pl-3 pr-2 backdrop-blur-sm">
          <button
            type="button"
            onClick={handleSearchClick}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:border-brand/40 hover:bg-brand/10 hover:text-brand-hover"
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
            <span className="text-xs font-semibold tracking-tight">{getUIText('aiBadge', language)}</span>
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 items-stretch gap-2 overflow-visible md:grid-cols-[minmax(190px,1.4fr)_minmax(170px,1.2fr)_minmax(170px,0.95fr)_minmax(132px,0.72fr)] xl:grid-cols-[minmax(240px,1.5fr)_minmax(220px,1.3fr)_220px_148px]">
        <WhereCombobox
          options={whereOptionsFull}
          value={where || 'all'}
          onChange={setWhere}
          placeholder={getUIText('wherePlaceholder', language)}
          fetchSuggestions={fetchWhereSuggestions}
          variant="flat"
          language={language}
          className={cn(UNIFIED_SEARCH_HERO_FIELD_CLASS, 'px-0')}
        />

        <SearchCalendar
          value={dateRange}
          onChange={setDateRange}
          locale={language}
          placeholder={getUIText('dates', language)}
          liveCount={liveCount}
          countLoading={countLoading}
          className={cn(UNIFIED_SEARCH_HERO_FIELD_CLASS, 'cursor-pointer')}
        />

        <GuestsPopover
          language={language}
          guests={guests}
          setGuests={setGuests}
          guestsBreakdown={guestsBreakdown}
          setGuestsBreakdown={setGuestsBreakdown}
          align="start"
          triggerClassName={cn(
            UNIFIED_SEARCH_HERO_FIELD_CLASS,
            'w-full min-w-0 max-w-full xl:min-w-[220px] xl:max-w-[220px] cursor-pointer',
          )}
        />

        <Button
          onClick={handleSearchClick}
          className="!h-[60px] min-h-[60px] max-h-[60px] min-w-[148px] shrink-0 rounded-2xl bg-brand px-6 text-base font-semibold leading-none text-white shadow-[0_14px_28px_-8px_rgba(0,102,102,0.42)] transition-all hover:bg-brand-hover hover:shadow-[0_18px_36px_-8px_rgba(0,102,102,0.50)] active:scale-[0.98]"
          data-testid="unified-search-button"
        >
          <Search className="mr-2 h-5 w-5" />
          {getUIText('findButton', language)}
        </Button>
      </div>

      {!dateRange?.from ? (
        <p className="mt-3 hidden items-center gap-1.5 px-1 text-xs text-white/75 md:flex">
          <Calendar className="h-3.5 w-3.5 text-white/70" aria-hidden />
          {language === 'ru'
            ? 'Выберите даты, чтобы увидеть точные цены и доступность'
            : 'Pick dates to see live pricing and availability'}
        </p>
      ) : null}
    </div>
  )
}

export default UnifiedSearchBar
