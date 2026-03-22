'use client'

/**
 * UnifiedSearchBar - Airbnb/Booking style: What | Where | When | Who
 * Where: умное поле с вводом и RU/EN подсказками (см. WhereCombobox).
 *
 * variant: 'hero' | 'filter'
 * - hero: Rounded bar on home page
 * - filter: Compact grid on search results page
 */

import { useState, useEffect, useMemo } from 'react'
import { Search, Users, Layers, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from '@/components/ui/drawer'
import { SearchCalendar } from '@/components/search-calendar'
import { WhereCombobox } from '@/components/search/WhereCombobox'
import { getUIText, getCategoryName } from '@/lib/translations'
import { buildWhereOptions, filterWhereOptions, getOptionLabel } from '@/lib/locations/where-options'
import { getStaticLocationsSeed } from '@/lib/locations/locations-seed'

const GUEST_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12]

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
  // Who
  guests,
  setGuests,
  onSearch,
  // Hero-only
  liveCount = null,
  countLoading = false,
  clearDates: _clearDates,
  nights = 0
}) {
  const [categories, setCategories] = useState([])
  /** Сразу известные города/районы (Пхукет) — без ожидания API; ответ locations подмешивает реальные данные */
  const [locations, setLocations] = useState(getStaticLocationsSeed)
  const [locationsLoading, setLocationsLoading] = useState(true)
  const [locationDrawerOpen, setLocationDrawerOpen] = useState(false)
  const [guestsDrawerOpen, setGuestsDrawerOpen] = useState(false)
  const [mobileWhereInput, setMobileWhereInput] = useState('')
  const [tempGuests, setTempGuests] = useState('2')

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

  const categoryLabel = category && category !== 'all'
    ? (getCategoryName(category, language) || categories.find(c => c.slug === category)?.name || category)
    : (language === 'ru' ? 'Что ищете?' : 'What?')

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

  const handleSearch = () => {
    onSearch?.()
  }

  const triggerBase = 'flex items-center gap-2 text-left hover:bg-slate-50 transition-colors'
  const triggerHero = 'px-4 py-3 border-r border-slate-200 min-w-0'

  if (variant === 'filter') {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
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
          variant="compact"
          className="min-w-0"
        />

        {/* When */}
        <SearchCalendar
          value={dateRange}
          onChange={setDateRange}
          locale={language}
          placeholder={getUIText('dates', language)}
          className="h-9 border rounded-md justify-start px-3"
        />

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
    )
  }

  // Hero variant - 4 fields: What | Where | When | Who
  return (
    <div className="bg-white rounded-full shadow-2xl border border-slate-200 overflow-visible">
      <div className="hidden md:flex items-center rounded-full overflow-visible">
        {/* What - Category */}
        <Popover>
          <PopoverTrigger asChild>
            <button className={`${triggerBase} ${triggerHero} flex-1 min-w-[120px] rounded-l-full`}>
              <Layers className="h-4 w-4 text-teal-600 flex-shrink-0" />
              <span className="text-sm text-slate-700 truncate">{categoryLabel}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="space-y-1">
              <button
                onClick={() => setCategory?.('all')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm ${(!category || category === 'all') ? 'bg-teal-50 text-teal-700' : 'hover:bg-slate-100'}`}
              >
                {language === 'ru' ? 'Всё' : 'All'}
              </button>
              {categories.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCategory?.(c.slug)}
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
        <Popover>
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
                  key={n}
                  onClick={() => setGuests?.(String(n))}
                  className={`p-2 rounded text-sm ${guests === String(n) ? 'bg-teal-600 text-white' : 'hover:bg-slate-100'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Button onClick={handleSearch} className="h-12 px-6 rounded-full bg-teal-600 hover:bg-teal-700 m-1" data-testid="unified-search-button">
          <Search className="h-4 w-4 mr-2" />{getUIText('findButton', language)}
        </Button>
      </div>

      {/* Mobile Hero */}
      <div className="md:hidden flex items-center p-1">
        <div className="flex-1 border-r border-slate-200">
          <SearchCalendar
            value={dateRange}
            onChange={setDateRange}
            locale={language}
            placeholder={nights > 0 ? `${nights}н.` : getUIText('dates', language)}
            liveCount={liveCount}
            countLoading={countLoading}
            className="justify-center py-3"
          />
        </div>
        <button
          onClick={() => setLocationDrawerOpen(true)}
          className="flex-1 flex items-center justify-center gap-2 py-3 border-r border-slate-200"
          data-testid="mobile-where-trigger"
        >
          <MapPin className="h-4 w-4 text-teal-600" />
          <span className="text-xs text-slate-700 truncate max-w-[60px]">{whereLabel}</span>
        </button>
        <button
          onClick={() => { setTempGuests(guests || '2'); setGuestsDrawerOpen(true); }}
          className="flex-1 flex items-center justify-center gap-2 py-3 border-r border-slate-200"
        >
          <Users className="h-4 w-4 text-teal-600" />
          <span className="text-xs text-slate-700">{guests}</span>
        </button>
        <Button onClick={handleSearch} size="icon" className="h-10 w-10 rounded-full bg-teal-600 hover:bg-teal-700 mx-1">
          <Search className="h-4 w-4" />
        </Button>
      </div>

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
            <DrawerTitle>{language === 'ru' ? 'Кто едет?' : 'Who?'}</DrawerTitle>
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
              {language === 'ru' ? 'Готово' : 'Done'}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
