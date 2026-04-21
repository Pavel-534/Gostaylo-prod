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
import { Search, Users, Layers, MapPin, Home, Bike, Anchor, Baby, Sparkles } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from '@/components/ui/drawer'
import { SearchCalendar } from '@/components/search-calendar'
import { WhereCombobox } from '@/components/search/WhereCombobox'
import { TimeSelect } from '@/components/ui/time-select'
import { getUIText, getCategoryName } from '@/lib/translations'
import { buildWhereOptions, filterWhereOptions, getOptionLabel } from '@/lib/locations/where-options'
import { getStaticLocationsSeed } from '@/lib/locations/locations-seed'
import { cn } from '@/lib/utils'

const GUEST_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12]

/** Порядок чипов на мобильном hero: подбираем slug из ответа /api/v2/categories */
const QUICK_CHIP_SPECS = [
  { candidates: ['property', 'villa', 'apartment', 'apartments', 'house'], icon: Home },
  { candidates: ['vehicles', 'vehicle', 'transport', 'transportation'], icon: Bike },
  { candidates: ['yachts', 'yacht', 'boats'], icon: Anchor },
  { candidates: ['nanny', 'babysitter'], icon: Baby },
]

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
  onSearch,
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
  const [guestsDrawerOpen, setGuestsDrawerOpen] = useState(false)
  const [mobileWhereInput, setMobileWhereInput] = useState('')
  const [tempGuests, setTempGuests] = useState('2')
  /** Контролируемые Popover на desktop — закрываются после выбора */
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false)
  const [guestsPopoverOpen, setGuestsPopoverOpen] = useState(false)

  useEffect(() => {
    fetch('/api/v2/categories')
      .then((r) => r.json())
      .then((catRes) => {
        if (catRes.success && catRes.data) setCategories(catRes.data)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/v2/search/locations')
      .then((r) => r.json())
      .then((locRes) => {
        if (locRes.success && locRes.data) setLocations(locRes.data)
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

  const handleGuestsConfirm = () => {
    setGuests(tempGuests)
    setGuestsDrawerOpen(false)
  }

  /** Кнопка «Найти» на hero: сначала commit семантики, затем переход/родитель */
  const handleHeroFindClick = () => {
    onSearchSubmit?.()
    onSearch?.()
  }

  const quickChips = useMemo(() => {
    return QUICK_CHIP_SPECS.map((spec) => {
      const cat = categories.find((c) =>
        spec.candidates.includes(String(c.slug || '').toLowerCase())
      )
      if (!cat) return null
      return {
        slug: cat.slug,
        icon: spec.icon,
        label: getCategoryName(cat.slug, language, cat.name),
      }
    }).filter(Boolean)
  }, [categories, language])

  const triggerBase = 'flex items-center gap-2 text-left hover:bg-slate-50 transition-colors'
  const triggerHero = 'px-4 py-3 border-r border-slate-200 min-w-0'

  const showTextSearch = typeof setTextQuery === 'function'
  const transportIntervalMode = String(category || '').toLowerCase() === 'vehicles'

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
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-teal-400 hover:bg-teal-50 hover:text-teal-700"
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
                {language === 'ru' ? 'ИИ' : 'Smart'}
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
            <Layers className="h-4 w-4 mr-2 text-teal-600" />
            <span className="truncate">
              {category && category !== 'all' ? (getCategoryName(category, language) || category) : (language === 'ru' ? 'Что?' : 'What?')}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{language === 'ru' ? 'Всё' : 'All'}</SelectItem>
            {categories.map(c => (
              <SelectItem key={c.id} value={c.slug}>{getCategoryName(c.slug, language) || c.name}</SelectItem>
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

        {/* Who */}
        <Select value={guests} onValueChange={setGuests}>
          <SelectTrigger className="h-9">
            <Users className="h-4 w-4 mr-2 text-teal-600" />
            <span>{guests} {getUIText('guests', language)}</span>
          </SelectTrigger>
          <SelectContent>
            {GUEST_OPTIONS.map(n => (
              <SelectItem key={n} value={n.toString()}>{n} {getUIText('guests', language)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        </div>
      </div>
    )
  }

  // Hero variant - 4 fields: What | Where | When | Who
  return (
    <div
      className={cn(
        'box-border w-full min-w-0 max-w-full overflow-x-hidden border border-slate-200 bg-white shadow-2xl md:overflow-visible',
        textSearchRow ? 'rounded-2xl' : 'rounded-2xl md:rounded-full',
      )}
    >
      {textSearchRow ? <div className="overflow-hidden rounded-t-2xl">{textSearchRow}</div> : null}
      <div
        className={cn(
          // overflow-visible: иначе WhereCombobox (absolute top-full) обрезается и подсказки «Куда» не видны
          'hidden md:flex items-center overflow-visible',
          textSearchRow ? 'rounded-b-2xl' : 'rounded-full',
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
                !textSearchRow && 'rounded-l-full',
              )}
            >
              <Layers className="h-4 w-4 text-teal-600 flex-shrink-0" />
              <span className="text-sm text-slate-700 truncate">{categoryLabel}</span>
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
                className={`w-full text-left px-3 py-2 rounded-md text-sm ${(!category || category === 'all') ? 'bg-teal-50 text-teal-700' : 'hover:bg-slate-100'}`}
              >
                {language === 'ru' ? 'Всё' : 'All'}
              </button>
              {categories.map(c => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => {
                    setCategory?.(c.slug)
                    setCategoryPopoverOpen(false)
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm ${category === c.slug ? 'bg-teal-50 text-teal-700' : 'hover:bg-slate-100'}`}
                >
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
          className="flex-1 min-w-[140px]"
        />

        {/* When */}
        <div className="border-r border-slate-200">
          <SearchCalendar
            value={dateRange}
            onChange={setDateRange}
            locale={language}
            placeholder={getUIText('dates', language)}
            liveCount={liveCount}
            countLoading={countLoading}
          />
        </div>

        {/* Who */}
        <Popover open={guestsPopoverOpen} onOpenChange={setGuestsPopoverOpen}>
          <PopoverTrigger asChild>
            <button className={`${triggerBase} ${triggerHero}`}>
              <Users className="h-4 w-4 text-teal-600" />
              <span className="text-sm text-slate-700">{guests}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start">
            <div className="grid grid-cols-5 gap-1">
              {GUEST_OPTIONS.map(n => (
                <button
                  type="button"
                  key={n}
                  onClick={() => {
                    setGuests?.(String(n))
                    setGuestsPopoverOpen(false)
                  }}
                  className={`p-2 rounded text-sm ${guests === String(n) ? 'bg-teal-600 text-white' : 'hover:bg-slate-100'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Button
          onClick={handleHeroFindClick}
          className={cn(
            'h-12 px-6 m-1 bg-teal-600 hover:bg-teal-700',
            textSearchRow ? 'rounded-br-2xl rounded-tr-2xl' : 'rounded-full',
          )}
          data-testid="unified-search-button"
        >
          <Search className="h-4 w-4 mr-2" />{getUIText('findButton', language)}
        </Button>
      </div>

      {/* Mobile Hero — stack Where + Guests (2-col row overflows narrow Android viewports) */}
      <div className="flex min-w-0 flex-col gap-2 p-3 md:hidden">
        <button
          type="button"
          onClick={() => setCategoryDrawerOpen(true)}
          className="flex w-full items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-left hover:bg-slate-50"
          data-testid="mobile-category-trigger"
        >
          <Layers className="h-4 w-4 shrink-0 text-teal-600" />
          <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{categoryLabel}</span>
        </button>
        <div className="rounded-xl border border-slate-200 overflow-hidden">
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
            className="flex min-h-[44px] w-full min-w-0 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-left hover:bg-slate-50"
            data-testid="mobile-where-trigger"
          >
            <MapPin className="h-4 w-4 shrink-0 text-teal-600" />
            <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{whereLabel}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTempGuests(guests || '2')
              setGuestsDrawerOpen(true)
            }}
            className="flex min-h-[44px] w-full min-w-0 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-left hover:bg-slate-50"
          >
            <Users className="h-4 w-4 shrink-0 text-teal-600" />
            <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
              {guests} {getUIText('guests', language)}
            </span>
          </button>
        </div>
        <Button
          onClick={handleHeroFindClick}
          className="h-11 w-full rounded-xl bg-teal-600 hover:bg-teal-700"
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
                      ? 'border-teal-600 bg-teal-50 text-teal-900'
                      : 'border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 text-teal-600" aria-hidden />
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
                  ? 'border-teal-600 bg-teal-50 text-teal-900'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              {language === 'ru' ? 'Всё' : 'All'}
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCategory?.(c.slug)
                  setCategoryDrawerOpen(false)
                }}
                className={`w-full rounded-lg border px-3 py-3 text-left text-sm ${
                  category === c.slug
                    ? 'border-teal-600 bg-teal-50 text-teal-900'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
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
                    where === opt.value ? 'border-teal-600 bg-teal-50 text-teal-900' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Mobile Guests Drawer */}
      <Drawer open={guestsDrawerOpen} onOpenChange={setGuestsDrawerOpen}>
        <DrawerContent>
          <DrawerHeader className="border-b pb-4">
            <DrawerTitle>{getUIText('mobileSearchWhoTitle', language)}</DrawerTitle>
            <DrawerClose asChild><Button variant="ghost" size="icon"><span className="sr-only">Close</span></Button></DrawerClose>
          </DrawerHeader>
          <div className="p-4">
            <div className="grid grid-cols-5 gap-2">
              {GUEST_OPTIONS.map(n => (
                <button
                  key={n}
                  onClick={() => setTempGuests(String(n))}
                  className={`p-3 rounded-lg border text-center font-medium ${tempGuests === String(n) ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-slate-200'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <DrawerFooter>
            <Button onClick={handleGuestsConfirm} className="w-full bg-teal-600">
              {getUIText('mobileSearchDone', language)}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
