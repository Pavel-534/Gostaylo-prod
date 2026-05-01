'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, MapPin, Users, Layers, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SearchCalendar } from '@/components/search-calendar'
import { WhereCombobox } from '@/components/search/WhereCombobox'
import { getUIText, getCategoryName } from '@/lib/translations'
import { buildWhereOptions } from '@/lib/locations/where-options'
import { getStaticLocationsSeed } from '@/lib/locations/locations-seed'
import { Input } from '@/components/ui/input'
import { HERO_BACKGROUND_IMAGE } from './home-constants'

const GUEST_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12]

/**
 * SSOT: статичные fallback-вкладки показываются немедленно, до ответа API.
 * Это устраняет «пустой» Hero при медленном соединении.
 */
const STATIC_FALLBACK_TABS = [
  { slug: 'property' },
  { slug: 'vehicles' },
  { slug: 'yachts' },
  { slug: 'tours' },
]

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
  onSearch,
  textQuery = '',
  setTextQuery,
  smartSearchOn = true,
  setSmartSearchOn,
  semanticSearchFeatureEnabled = true,
  onSearchSubmit,
  liveCount = null,
  countLoading = false,
}) {
  const [locations, setLocations] = useState(getStaticLocationsSeed)
  const [locationsLoading, setLocationsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/v2/search/locations')
      .then((r) => r.json())
      .then((locRes) => {
        if (locRes.success && locRes.data) setLocations(locRes.data)
      })
      .catch(() => {})
      .finally(() => setLocationsLoading(false))
  }, [])

  const whereOptionsFull = useMemo(() => buildWhereOptions(locations, language), [locations, language])

  // SSOT fallback: show static tabs immediately, replace with real data when loaded
  const displayTabs = categoryTabs.length > 0 ? categoryTabs : STATIC_FALLBACK_TABS
  const tabsReady = categoryTabs.length > 0

  const handleSearchClick = () => {
    onSearchSubmit?.()
    onSearch?.()
  }

  return (
    <section
      className="relative isolate min-h-[820px] pt-20"
      style={{ backgroundImage: `url(${HERO_BACKGROUND_IMAGE})`, backgroundSize: 'cover', backgroundPosition: 'center top' }}
    >
      {/* Cinematic layered overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/30 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-black/10" />
      <div className="absolute inset-x-0 bottom-0 h-52 bg-gradient-to-b from-transparent to-[#f7f9fb]" />

      {/* Content layer */}
      <div className="relative z-10 mx-auto flex min-h-[730px] w-full max-w-[1280px] flex-col items-center justify-center px-6 text-center">

        {/* Editorial headline */}
        <div className="mb-6 space-y-2">
          <h1 className="max-w-3xl text-[42px] font-extrabold leading-[1.1] tracking-[-0.03em] text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.45)] sm:text-[60px] sm:leading-[1.08]">
            {getUIText('heroTitle', language)}{' '}
            <span className="bg-gradient-to-r from-[#a2f0ef] to-[#5dd8d5] bg-clip-text text-transparent">
              {getUIText('heroTitleHighlight', language)}
            </span>
          </h1>
          <p className="text-[15px] font-medium text-white/80 drop-shadow-sm sm:text-base">
            <MapPin className="mr-1 inline-block h-4 w-4 text-[#a2f0ef]" />
            {getUIText('heroSubtitle', language)}
          </p>
        </div>

        {/* Search capsule */}
        <div className="w-full max-w-4xl rounded-[28px] border border-white/70 bg-white/98 p-2 shadow-[0_44px_100px_rgba(0,24,24,0.38),0_18px_42px_rgba(0,102,102,0.22)] backdrop-blur-sm transition-all duration-300 focus-within:shadow-[0_44px_100px_rgba(0,24,24,0.45),0_0_0_3px_rgba(0,102,102,0.18)] focus-within:-translate-y-0.5">

          {/* Keyword row */}
          <div className="mb-2 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/90 px-3 py-2">
            <button
              type="button"
              onClick={handleSearchClick}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-teal-400 hover:bg-teal-50 hover:text-teal-700"
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
              className="h-9 min-w-0 flex-1 border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
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
              className={`flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 transition-colors ${
                !semanticSearchFeatureEnabled
                  ? 'cursor-not-allowed opacity-50'
                  : smartSearchOn
                    ? 'border-violet-300 bg-violet-50 text-violet-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Sparkles className="h-4 w-4 shrink-0" />
              <span className="text-xs font-semibold tracking-tight">{language === 'ru' ? 'ИИ' : 'Smart'}</span>
            </button>
          </div>

          {/* Category tabs row */}
          <div className="mb-3 flex flex-wrap items-center gap-0 border-b border-slate-100 px-2 pt-0">
            {displayTabs.map((tab) => {
              const active = category === tab.slug
              return (
                <button
                  key={tab.slug}
                  type="button"
                  onClick={() => setCategory?.(tab.slug)}
                  className={`relative px-5 py-2.5 text-sm font-semibold tracking-tight transition-all duration-200 ${
                    active
                      ? 'text-[#006666]'
                      : 'text-slate-500 hover:text-[#006666]'
                  } ${!tabsReady ? 'animate-pulse opacity-60' : ''}`}
                >
                  {getCategoryName(tab.slug, language, tab.name)}
                  {active && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-[#006666]" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Fields grid */}
          <div className="grid grid-cols-1 gap-2 px-3 pb-3 md:grid-cols-[1.3fr_1.15fr_0.85fr_0.7fr] overflow-visible">
            <div className="min-w-0 border-r border-slate-100 px-3 text-left overflow-visible">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                {language === 'ru' ? 'Категория' : 'Category'}
              </label>
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-[#006666]" />
                <span className="truncate text-[15px] font-medium text-slate-800">
                  {category && category !== 'all'
                    ? getCategoryName(category, language)
                    : getUIText('mobileSearchWhatTitle', language)}
                </span>
              </div>
            </div>

            <div className="min-w-0 border-r border-slate-100 px-3 text-left overflow-visible">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                {language === 'ru' ? 'Локация' : 'Location'}
              </label>
              <WhereCombobox
                options={whereOptionsFull}
                value={where || 'all'}
                onChange={setWhere}
                placeholder={getUIText('wherePlaceholder', language)}
                loading={locationsLoading}
                variant="hero"
                className="min-h-[40px] min-w-0 [&_button]:h-auto [&_button]:min-h-[40px] [&_button]:rounded-none [&_button]:border-0 [&_button]:px-0 [&_button]:shadow-none [&_button]:focus:ring-0"
              />
            </div>

            <div className="min-w-0 border-r border-slate-100 px-3 text-left">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                {language === 'ru' ? 'Даты' : 'Dates'}
              </label>
              <SearchCalendar
                value={dateRange}
                onChange={setDateRange}
                locale={language}
                placeholder={getUIText('dates', language)}
                liveCount={liveCount}
                countLoading={countLoading}
                className="min-h-[40px] justify-start border-0 px-0 shadow-none"
              />
            </div>

            <div className="flex items-end px-2">
              <Popover>
                <PopoverTrigger asChild>
                  <button className="mr-2 flex h-12 min-w-[90px] items-center justify-start gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 transition-colors hover:border-teal-300 hover:bg-teal-50">
                    <Users className="h-4 w-4 text-[#006666]" />
                    {guests}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="start">
                  <div className="grid grid-cols-4 gap-1">
                    {GUEST_OPTIONS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setGuests?.(String(n))}
                        className={`rounded-md p-2 text-sm transition-colors ${guests === String(n) ? 'bg-[#006666] text-white' : 'hover:bg-slate-100'}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                onClick={handleSearchClick}
                className="h-12 flex-1 rounded-2xl bg-[#006666] text-[15px] font-semibold text-white shadow-[0_12px_24px_rgba(0,102,102,0.28)] transition-all hover:bg-[#004c4c] hover:shadow-[0_16px_32px_rgba(0,102,102,0.36)] active:scale-[0.98]"
              >
                <Search className="mr-2 h-4 w-4" />
                {getUIText('findButton', language)}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

