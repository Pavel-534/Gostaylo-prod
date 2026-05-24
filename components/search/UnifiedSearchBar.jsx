'use client'

/**
 * UnifiedSearchBar - Airbnb/Booking style: What | Where | When | Who
 * Where: умное поле с вводом и RU/EN подсказками (см. WhereCombobox).
 *
 * variant: 'hero' | 'filter'
 * - hero: Rounded bar on home page
 * - filter: Compact grid on search results page
 *
 * Listings for grid/map: @/lib/search-endpoints LISTINGS_SEARCH_API_PATH (not fetched here).
 */

import { useState, useEffect, useMemo } from 'react'
import { Search, Layers, MapPin, Sparkles } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from '@/components/ui/drawer'
import { SearchCalendar } from '@/components/search-calendar'
import { WhereCombobox } from '@/components/search/WhereCombobox'
import { GuestsPopover } from '@/components/search/GuestsPopover'
import { TimeSelect } from '@/components/ui/time-select'
import { getUIText, getCategoryName } from '@/lib/translations'
import { buildWhereOptions, filterWhereOptions, getOptionLabel } from '@/lib/locations/where-options'
import { getStaticLocationsSeed } from '@/lib/locations/locations-seed'
import { cn } from '@/lib/utils'
import { isTransportIntervalWizardProfile } from '@/lib/config/category-wizard-profile-db'
import { chipIconForCategory } from '@/components/search/category-chip-icon'
import { orderedCategoriesForSearchUi, effectiveCategoryWizardProfileRaw } from '@/lib/config/category-hierarchy'
import { fetchCategories } from '@/lib/client-data'
import { fetchSearchLocations } from '@/lib/api/catalog-public-client'

export function UnifiedSearchBar({
  variant = 'hero',
  language = 'ru',
  // What (Category)
  category,
  setCategory,
  // Where (single: city OR district - smart)
  where,
  setWhere,
  // When
  dateRange,
  setDateRange,
  checkInTime = '07:00',
  setCheckInTime,
  checkOutTime = '07:00',
  setCheckOutTime,
  // Who
  guests,
  setGuests,
  guestsBreakdown = null,
  setGuestsBreakdown,
  onSearch,
  /** `categories.wizard_profile` для текущего `category` (SSOT транспортный интервал и т.д.) */
  categoryWizardProfile = null,
  /** Мобильный hero: мгновенный переход в /listings с выбранной категорией */
  onQuickCategorySearch,
  /** Текстовый поиск + умный поиск (semantic=1); если setTextQuery не передан — строка скрыта */
  textQuery = '',
  setTextQuery,
  smartSearchOn = true,
  setSmartSearchOn,
  /** Сайтовый фича-флаг из /api/v2/site-features */
  semanticSearchFeatureEnabled = true,
  /** Лупа / Enter / «Найти»: запуск полного поиска с semantic (если включён ИИ на сайте и в переключателе) */
  onSearchSubmit,
  // Hero-only
  liveCount = null,
  countLoading = false,
  clearDates: _clearDates,
  nights: _nights = 0
}) {
  const [categories, setCategories] = useState([])
  /** Сразу известные города/районы (Пхукет) — без ожидания API; ответ locations подмешивает реальные данные */
  const [locations, setLocations] = useState(getStaticLocationsSeed)
  const [locationsLoading, setLocationsLoading] = useState(true)
  const [locationDrawerOpen, setLocationDrawerOpen] = useState(false)
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false)
  const [mobileWhereInput, setMobileWhereInput] = useState('')
  /** Контролируемые Popover на desktop — закрываются после выбора */
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false)

  useEffect(() => {
    fetchCategories()
      .then((cats) => setCategories(cats || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchSearchLocations()
      .then(({ ok, locations }) => {
        if (ok) setLocations(locations)
      })
      .catch(() => {})
      .finally(() => setLocationsLoading(false))
  }, [])

  const whereOptionsFull = useMemo(
    () => buildWhereOptions(locations, language),
    [locations, language]
  )

  const categoryLabel =
    category && category !== 'all'
      ? getCategoryName(category, language) || categories.find((c) => c.slug === category)?.name || category
      : getUIText('mobileSearchWhatTitle', language)

  const whereLabel =
    where && where !== 'all' ? getOptionLabel(whereOptionsFull, where) : getUIText('wherePlaceholder', language)

  useEffect(() => {
    if (locationDrawerOpen) {
      setMobileWhereInput(
        where && where !== 'all' ? getOptionLabel(whereOptionsFull, where) : ''
      )
    }
  }, [locationDrawerOpen, where, whereOptionsFull])

  /** Кнопка «Найти» на hero: сначала commit семантики, затем переход/родитель */
  const handleHeroFindClick = () => {
    onSearchSubmit?.()
    onSearch?.()
  }

  const quickChips = useMemo(() => {
    return [...(categories || [])]
      .filter((c) => c && c.slug && !(c.parentId || c.parent_id))
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
      .slice(0, 12)
      .map((cat) => ({
        slug: cat.slug,
        icon: chipIconForCategory(cat),
        label: getCategoryName(cat.slug, language, cat.name),
      }))
  }, [categories, language])

  const orderedCategoryRows = useMemo(() => orderedCategoriesForSearchUi(categories), [categories])

  const triggerBase = 'flex items-center gap-2 text-left hover:bg-slate-50 transition-colors'
  const triggerHero = 'px-6 py-4 border-r border-slate-200/80 min-w-0'

  const showTextSearch = typeof setTextQuery === 'function'
  const transportIntervalMode = useMemo(() => {
    const eff =
      categoryWizardProfile ?? effectiveCategoryWizardProfileRaw(category, categories)
    return isTransportIntervalWizardProfile(eff, category)
  }, [categoryWizardProfile, category, categories])

  const textSearchRow = showTextSearch ? (
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
        {textSearchRow ? (
          <div className="overflow-hidden rounded-t-lg">{textSearchRow}</div>
        ) : null}
        <div className="grid grid-cols-2 gap-2 border-t-0 p-2 md:grid-cols-4 md:p-2">
        {/* What - Category */}
        <Select value={category || 'all'} onValueChange={(v) => setCategory?.(v)}>
          <SelectTrigger className="h-9">
            <Layers className="h-4 w-4 mr-2 text-brand" />
            <span className="truncate">
              {category && category !== 'all' ? (getCategoryName(category, language) || category) : getUIText('whatPlaceholder', language)}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{getUIText('allLabel', language)}</SelectItem>
            {orderedCategoryRows.map(({ cat: c, depth }) => (
              <SelectItem key={c.id} value={c.slug} className={depth ? 'pl-7' : ''}>
                {depth ? '· ' : ''}
                {getCategoryName(c.slug, language) || c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Where — умное поле */}
        <WhereCombobox
          options={whereOptionsFull}
          value={where || 'all'}
          onChange={setWhere}
          placeholder={getUIText('whereShort', language)}
          loading={locationsLoading}
          loadingPlaceholder={getUIText('loading', language)}
          variant="compact"
          language={language}
          className="min-w-0"
        />

        {/* When */}
        <div className="min-w-0 space-y-1">
          <SearchCalendar
            value={dateRange}
            onChange={setDateRange}
            locale={language}
            placeholder={getUIText('dates', language)}
            className="h-9 w-full min-w-0 border rounded-md justify-start px-3"
          />
          {transportIntervalMode && dateRange?.from && dateRange?.to && (
            <div className="grid grid-cols-2 gap-1">
              <TimeSelect
                value={checkInTime}
                onChange={setCheckInTime}
                className="h-8 text-xs"
              />
              <TimeSelect
                value={checkOutTime}
                onChange={setCheckOutTime}
                className="h-8 text-xs"
              />
            </div>
          )}
        </div>

        {/* Who (SSOT Airbnb-style popover) */}
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
    )
  }

  // Hero variant - 4 fields: What | Where | When | Who
  return (
    <div
      className={cn(
        'box-border w-full min-w-0 max-w-full overflow-x-hidden border border-slate-200/90 bg-white md:overflow-visible',
        'rounded-[26px] shadow-[0_32px_64px_rgba(0,102,102,0.16),0_10px_24px_rgba(15,23,42,0.12)]',
      )}
    >
      {textSearchRow ? <div className="overflow-hidden rounded-t-[26px]">{textSearchRow}</div> : null}
      <div
        className={cn(
          // overflow-visible: иначе WhereCombobox (absolute top-full) обрезается и подсказки «Куда» не видны
          'hidden md:flex items-center overflow-visible',
          textSearchRow ? 'rounded-b-[26px]' : 'rounded-[26px]',
        )}
      >
        {/* What - Category */}
        <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                triggerBase,
                triggerHero,
                'flex-1 min-w-[120px]',
                !textSearchRow && 'rounded-l-[26px]',
              )}
            >
              <Layers className="h-4 w-4 text-brand flex-shrink-0" />
              <span className="text-[15px] font-medium text-slate-800 truncate">{categoryLabel}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  setCategory?.('all')
                  setCategoryPopoverOpen(false)
                }}
                className={`w-full text-left px-3 py-2 rounded-md text-sm ${(!category || category === 'all') ? 'bg-brand/10 text-brand-hover' : 'hover:bg-slate-100'}`}
              >
                {getUIText('allLabel', language)}
              </button>
              {orderedCategoryRows.map(({ cat: c, depth }) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => {
                    setCategory?.(c.slug)
                    setCategoryPopoverOpen(false)
                  }}
                  className={`w-full rounded-md py-2 text-left text-sm ${depth ? 'pl-6 pr-3' : 'px-3'} ${category === c.slug ? 'bg-brand/10 text-brand-hover' : 'hover:bg-slate-100'}`}
                >
                  {depth ? '· ' : ''}
                  {getCategoryName(c.slug, language) || c.name}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Where — ввод в строке + подсказки RU/EN */}
        <WhereCombobox
          options={whereOptionsFull}
          value={where || 'all'}
          onChange={setWhere}
          placeholder={getUIText('wherePlaceholder', language)}
          loading={locationsLoading}
          loadingPlaceholder={getUIText('loading', language)}
          variant="hero"
          language={language}
          className="min-w-[180px] flex-[1.2] xl:min-w-[220px]"
        />

        {/* When */}
        <div className="min-w-[180px] border-r border-slate-200 xl:min-w-[220px]">
          <SearchCalendar
            value={dateRange}
            onChange={setDateRange}
            locale={language}
            placeholder={getUIText('dates', language)}
            liveCount={liveCount}
            countLoading={countLoading}
          />
        </div>

        {/* Who (SSOT Airbnb-style popover) */}
        <GuestsPopover
          language={language}
          guests={guests}
          setGuests={setGuests}
          guestsBreakdown={guestsBreakdown}
          setGuestsBreakdown={setGuestsBreakdown}
          align="start"
          triggerClassName={`${triggerBase} ${triggerHero} w-[clamp(170px,22vw,220px)] min-w-[170px] max-w-[220px]`}
        />

        <Button
          onClick={handleHeroFindClick}
          className={cn(
            'h-[54px] px-8 m-1.5 bg-brand hover:bg-brand-hover text-[15px] font-semibold shadow-[0_12px_24px_rgba(0,102,102,0.28)]',
            textSearchRow ? 'rounded-br-[22px] rounded-tr-[22px]' : 'rounded-[20px]',
          )}
          data-testid="unified-search-button"
        >
          <Search className="h-4 w-4 mr-2" />{getUIText('findButton', language)}
        </Button>
      </div>

      {/* Mobile Hero — stack Where + Guests (2-col row overflows narrow Android viewports) */}
      <div className="flex min-w-0 flex-col gap-2 p-4 md:hidden">
        <button
          type="button"
          onClick={() => setCategoryDrawerOpen(true)}
          className="flex w-full items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3.5 text-left hover:bg-slate-50"
          data-testid="mobile-category-trigger"
        >
          <Layers className="h-4 w-4 shrink-0 text-brand" />
          <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{categoryLabel}</span>
        </button>
        <div className="rounded-2xl border border-slate-200 overflow-hidden">
          <SearchCalendar
            value={dateRange}
            onChange={setDateRange}
            locale={language}
            placeholder={getUIText('dates', language)}
            liveCount={liveCount}
            countLoading={countLoading}
            className="w-full justify-start px-3 py-3"
          />
        </div>
        {transportIntervalMode && dateRange?.from && dateRange?.to && (
          <div className="grid grid-cols-2 gap-2">
            <TimeSelect
              value={checkInTime}
              onChange={setCheckInTime}
              className="h-10 rounded-xl border-slate-200"
            />
            <TimeSelect
              value={checkOutTime}
              onChange={setCheckOutTime}
              className="h-10 rounded-xl border-slate-200"
            />
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-2">
          <button
            type="button"
            onClick={() => setLocationDrawerOpen(true)}
          className="flex min-h-[44px] w-full min-w-0 items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-left hover:bg-slate-50"
            data-testid="mobile-where-trigger"
          >
            <MapPin className="h-4 w-4 shrink-0 text-brand" />
            <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{whereLabel}</span>
          </button>
          <div className="flex min-h-[44px] w-full min-w-0 items-center gap-2 rounded-2xl border border-slate-200 px-0 py-0 text-left hover:bg-slate-50">
            <GuestsPopover
              language={language}
              guests={guests}
              setGuests={setGuests}
              guestsBreakdown={guestsBreakdown}
              setGuestsBreakdown={setGuestsBreakdown}
              align="start"
              triggerClassName="min-h-[44px] w-full rounded-2xl border-0 px-4 py-2.5 text-sm"
              contentClassName="z-[90]"
            />
          </div>
        </div>
        <Button
          onClick={handleHeroFindClick}
          className="h-12 w-full rounded-2xl bg-brand hover:bg-brand-hover text-[15px] font-semibold shadow-[0_10px_22px_rgba(0,102,102,0.25)]"
          data-testid="unified-search-button"
        >
          <Search className="mr-2 h-4 w-4" />
          {getUIText('findButton', language)}
        </Button>

        {variant === 'hero' && onQuickCategorySearch && quickChips.length > 0 ? (
          <div
            className="-mx-0 flex min-w-0 gap-2 overflow-x-auto pb-1 pt-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:gap-3"
            role="list"
            aria-label={getUIText('categories', language)}
          >
            {quickChips.map((chip) => {
              const Icon = chip.icon
              const active = category === chip.slug
              return (
                <button
                  key={chip.slug}
                  type="button"
                  role="listitem"
                  onClick={() => {
                    setCategory?.(chip.slug)
                    onQuickCategorySearch(chip.slug)
                  }}
                  className={cn(
                    'flex snap-start shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors',
                    active
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                  {chip.label}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>

      {/* Mobile category drawer */}
      <Drawer open={categoryDrawerOpen} onOpenChange={setCategoryDrawerOpen}>
        <DrawerContent className="max-h-[min(70vh,520px)]">
          <DrawerHeader className="border-b pb-4">
            <DrawerTitle>{getUIText('mobileSearchWhatTitle', language)}</DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon">
                <span className="sr-only">Close</span>
              </Button>
            </DrawerClose>
          </DrawerHeader>
          <div className="max-h-[55vh] overflow-y-auto p-4 space-y-1">
            <button
              type="button"
              onClick={() => {
                setCategory?.('all')
                setCategoryDrawerOpen(false)
              }}
              className={`w-full rounded-lg border px-3 py-3 text-left text-sm ${
                !category || category === 'all'
                  ? 'border-brand bg-brand/10 text-brand'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              {getUIText('allLabel', language)}
            </button>
            {orderedCategoryRows.map(({ cat: c, depth }) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCategory?.(c.slug)
                  setCategoryDrawerOpen(false)
                }}
                className={`w-full rounded-lg border py-3 text-left text-sm ${
                  depth ? 'border-slate-200 pl-6 pr-3' : 'border-slate-200 px-3'
                } ${
                  category === c.slug
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                {depth ? '· ' : ''}
                {getCategoryName(c.slug, language) || c.name}
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Mobile Location Drawer */}
      <Drawer open={locationDrawerOpen} onOpenChange={setLocationDrawerOpen}>
        <DrawerContent className="h-[70vh] max-h-[70vh]">
          <DrawerHeader className="border-b pb-4">
            <DrawerTitle>{getUIText('whereShort', language)}</DrawerTitle>
            <DrawerClose asChild><Button variant="ghost" size="icon"><span className="sr-only">Close</span></Button></DrawerClose>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <Input
              placeholder={getUIText('cityOrAreaHint', language)}
              value={mobileWhereInput}
              onChange={(e) => setMobileWhereInput(e.target.value)}
              className="mb-2"
            />
            <div className="space-y-1">
              {filterWhereOptions(whereOptionsFull, mobileWhereInput).map((opt) => (
                <button
                  key={`${opt.type}-${opt.value}`}
                  type="button"
                  onClick={() => {
                    setWhere?.(opt.value)
                    setLocationDrawerOpen(false)
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm border ${
                    where === opt.value ? 'border-brand bg-brand/10 text-brand' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

    </div>
  )
}
