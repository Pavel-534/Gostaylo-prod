'use client'

/**
 * Gostaylo - Search Results Page (Optimized)
 * 
 * Features:
 * - Global date synchronization
 * - 300ms debounced API calls
 * - Client-side caching (5-minute TTL)
 * - Infinite scroll pagination (12 items per batch)
 * - Smooth fade-in/out animations
 * - Error handling with retry
 * 
 * @optimized 2026-03-13
 */

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Search, ArrowLeft, MapPin, Loader2, Users, X, AlertCircle, RefreshCw, CalendarIcon } from 'lucide-react'
import { fetchExchangeRates } from '@/lib/client-data'
import { GostayloListingCard } from '@/components/gostaylo-listing-card'
import { ListingGridSkeleton } from '@/components/listing-card-skeleton'
import { SearchCalendar } from '@/components/search-calendar'
import { format, parseISO, isSameDay, differenceInDays } from 'date-fns'
import { ru, enUS } from 'date-fns/locale'
import { cn } from '@/lib/utils'

// Constants
const DISTRICTS = [
  'Patong', 'Kata', 'Karon', 'Kamala', 'Rawai', 'Chalong', 
  'Bang Tao', 'Nai Harn', 'Panwa', 'Mai Khao', 'Nai Yang', 'Surin'
]
const ITEMS_PER_PAGE = 12
const DEBOUNCE_DELAY = 300
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// =========================================================
// CUSTOM HOOKS
// =========================================================

// Debounce hook with configurable delay
function useDebounce(value, delay = DEBOUNCE_DELAY) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  
  return debouncedValue
}

// Simple in-memory cache
const searchCache = new Map()

function getCacheKey(params) {
  return JSON.stringify(Object.fromEntries(params.entries()))
}

function getFromCache(key) {
  const cached = searchCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }
  searchCache.delete(key)
  return null
}

function setCache(key, data) {
  // Limit cache size
  if (searchCache.size > 50) {
    const firstKey = searchCache.keys().next().value
    searchCache.delete(firstKey)
  }
  searchCache.set(key, { data, timestamp: Date.now() })
}

// Intersection Observer hook for infinite scroll
function useIntersectionObserver(callback, options = {}) {
  const targetRef = useRef(null)
  
  useEffect(() => {
    const target = targetRef.current
    if (!target) return
    
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        callback()
      }
    }, { threshold: 0.1, ...options })
    
    observer.observe(target)
    return () => observer.disconnect()
  }, [callback, options])
  
  return targetRef
}

// =========================================================
// MAIN COMPONENT
// =========================================================

function ListingsContent() {
  const searchParams = useSearchParams()
  
  // Read initial values from URL (Single Source of Truth)
  const initialCategory = searchParams.get('category') || 'all'
  const initialLocation = searchParams.get('location') || 'all'
  const initialCheckIn = searchParams.get('checkIn')
  const initialCheckOut = searchParams.get('checkOut')
  const initialGuests = searchParams.get('guests') || '2'
  const initialQuery = searchParams.get('q') || ''
  
  // =========================================================
  // GLOBAL STATE - Lifted for synchronization
  // =========================================================
  const [listings, setListings] = useState([])
  const [allListings, setAllListings] = useState([]) // Full results for pagination
  const [displayedCount, setDisplayedCount] = useState(ITEMS_PER_PAGE)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [meta, setMeta] = useState(null)
  const [error, setError] = useState(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  
  // Filter state (synced with URL)
  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const [selectedCategory, setSelectedCategory] = useState(initialCategory)
  const [selectedDistrict, setSelectedDistrict] = useState(initialLocation)
  const [guests, setGuests] = useState(initialGuests)
  const [dateRange, setDateRange] = useState({
    from: initialCheckIn ? parseISO(initialCheckIn) : null,
    to: initialCheckOut ? parseISO(initialCheckOut) : null
  })
  
  // UI state
  const [language, setLanguage] = useState('en')
  const [currency, setCurrency] = useState('THB')
  const [exchangeRates, setExchangeRates] = useState({ THB: 1, USD: 35.5, RUB: 0.37 })

  // Debounced values for API calls
  const debouncedQuery = useDebounce(searchQuery)
  const debouncedDistrict = useDebounce(selectedDistrict)
  const debouncedGuests = useDebounce(guests)
  const debouncedDateRange = useDebounce(dateRange)

  // Request counter for race condition prevention
  const requestIdRef = useRef(0)

  // =========================================================
  // INITIALIZATION
  // =========================================================
  
  useEffect(() => {
    const storedLang = localStorage.getItem('gostaylo_language')
    if (storedLang) {
      setLanguage(storedLang)
    } else {
      const browserLang = navigator.language.split('-')[0]
      setLanguage(['ru', 'en', 'zh', 'th'].includes(browserLang) ? browserLang : 'en')
    }
    
    const storedCurrency = localStorage.getItem('gostaylo_currency')
    if (storedCurrency) setCurrency(storedCurrency)
    
    fetchExchangeRates().then(setExchangeRates).catch(console.error)
  }, [])

  useEffect(() => {
    const handleCurrencyChange = (e) => setCurrency(e.detail)
    window.addEventListener('currency-change', handleCurrencyChange)
    return () => window.removeEventListener('currency-change', handleCurrencyChange)
  }, [])

  // =========================================================
  // API FETCH with Caching & Error Handling
  // =========================================================
  
  const fetchListings = useCallback(async (isInitial = false) => {
    const currentRequestId = ++requestIdRef.current
    
    // Build params
    const params = new URLSearchParams()
    if (debouncedQuery) params.set('q', debouncedQuery)
    if (selectedCategory && selectedCategory !== 'all') params.set('category', selectedCategory)
    if (debouncedDistrict && debouncedDistrict !== 'all') params.set('location', debouncedDistrict)
    if (debouncedDateRange.from) params.set('checkIn', format(debouncedDateRange.from, 'yyyy-MM-dd'))
    if (debouncedDateRange.to && !isSameDay(debouncedDateRange.from, debouncedDateRange.to)) {
      params.set('checkOut', format(debouncedDateRange.to, 'yyyy-MM-dd'))
    }
    if (debouncedGuests) params.set('guests', debouncedGuests)
    params.set('limit', '100') // Fetch more for client-side pagination
    
    const cacheKey = getCacheKey(params)
    
    // Check cache first (only for non-date queries to ensure availability is fresh)
    const hasDates = debouncedDateRange.from && debouncedDateRange.to
    if (!hasDates) {
      const cached = getFromCache(cacheKey)
      if (cached) {
        console.log('[SEARCH] Cache HIT:', cacheKey.substring(0, 50))
        if (currentRequestId !== requestIdRef.current) return // Stale request
        
        setAllListings(cached.listings)
        setListings(cached.listings.slice(0, ITEMS_PER_PAGE))
        setDisplayedCount(ITEMS_PER_PAGE)
        setMeta(cached.meta)
        setLoading(false)
        setError(null)
        return
      }
    }
    
    // Start transition animation
    if (!isInitial && listings.length > 0) {
      setIsTransitioning(true)
      await new Promise(r => setTimeout(r, 150)) // Brief fade out
    }
    
    if (isInitial) setLoading(true)
    setError(null)
    
    try {
      console.log('[SEARCH] Fetching:', params.toString().substring(0, 80))
      const res = await fetch(`/api/v2/search?${params.toString()}`)
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }
      
      const data = await res.json()
      
      // Check if this request is still relevant
      if (currentRequestId !== requestIdRef.current) {
        console.log('[SEARCH] Stale request ignored')
        return
      }
      
      if (data.success) {
        const newListings = data.data.listings || []
        
        // Cache results (skip if dates filter applied - availability changes)
        if (!hasDates) {
          setCache(cacheKey, { listings: newListings, meta: data.data.meta })
        }
        
        setAllListings(newListings)
        setListings(newListings.slice(0, ITEMS_PER_PAGE))
        setDisplayedCount(ITEMS_PER_PAGE)
        setMeta(data.data.meta)
        setError(null)
      } else {
        throw new Error(data.error || 'Unknown error')
      }
    } catch (err) {
      console.error('[SEARCH] Error:', err)
      if (currentRequestId === requestIdRef.current) {
        setError(err.message)
        setListings([])
        setAllListings([])
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false)
        setIsTransitioning(false)
      }
    }
  }, [debouncedQuery, selectedCategory, debouncedDistrict, debouncedDateRange, debouncedGuests, listings.length])

  // Initial fetch on mount
  useEffect(() => {
    fetchListings(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  // Refetch when debounced filters change
  useEffect(() => {
    if (!loading) {
      fetchListings(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, selectedCategory, debouncedDistrict, debouncedDateRange, debouncedGuests])

  // =========================================================
  // URL SYNC - Shallow routing
  // =========================================================
  
  useEffect(() => {
    const params = new URLSearchParams()
    
    if (debouncedQuery) params.set('q', debouncedQuery)
    if (selectedCategory && selectedCategory !== 'all') params.set('category', selectedCategory)
    if (debouncedDistrict && debouncedDistrict !== 'all') params.set('location', debouncedDistrict)
    if (debouncedDateRange.from) params.set('checkIn', format(debouncedDateRange.from, 'yyyy-MM-dd'))
    if (debouncedDateRange.to && !isSameDay(debouncedDateRange.from, debouncedDateRange.to)) {
      params.set('checkOut', format(debouncedDateRange.to, 'yyyy-MM-dd'))
    }
    if (debouncedGuests && debouncedGuests !== '1') params.set('guests', debouncedGuests)
    
    const url = params.toString() ? `/listings?${params.toString()}` : '/listings'
    window.history.replaceState({}, '', url)
  }, [debouncedQuery, selectedCategory, debouncedDistrict, debouncedDateRange, debouncedGuests])

  // =========================================================
  // INFINITE SCROLL - Load more items
  // =========================================================
  
  const loadMore = useCallback(() => {
    if (loadingMore || displayedCount >= allListings.length) return
    
    setLoadingMore(true)
    
    // Simulate network delay for smooth UX
    setTimeout(() => {
      const newCount = Math.min(displayedCount + ITEMS_PER_PAGE, allListings.length)
      setListings(allListings.slice(0, newCount))
      setDisplayedCount(newCount)
      setLoadingMore(false)
    }, 300)
  }, [loadingMore, displayedCount, allListings])

  const loadMoreRef = useIntersectionObserver(loadMore)

  // =========================================================
  // HELPERS
  // =========================================================
  
  const clearDates = useCallback(() => {
    setDateRange({ from: null, to: null })
  }, [])

  const retry = useCallback(() => {
    setError(null)
    fetchListings(true)
  }, [fetchListings])

  // Memoized values
  const nights = useMemo(() => 
    dateRange.from && dateRange.to ? differenceInDays(dateRange.to, dateRange.from) : 0,
  [dateRange])
  
  const locale = language === 'ru' ? ru : enUS
  
  const hasMore = displayedCount < allListings.length
  
  // Format dates for cards
  const cardDates = useMemo(() => ({
    checkIn: dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : null,
    checkOut: dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : null
  }), [dateRange])

  // =========================================================
  // RENDER
  // =========================================================
  
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-teal-600 transition-colors">
            <ArrowLeft className="h-5 w-5" />
            <span className="hidden sm:inline">{language === 'ru' ? 'На главную' : 'Back'}</span>
          </Link>
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center text-white font-bold">G</div>
            <span className="font-semibold text-lg hidden sm:inline">Gostaylo</span>
          </Link>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white py-6">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="bg-white/20 text-white">
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                `${allListings.length} ${language === 'ru' ? 'объектов' : 'properties'}`
              )}
            </Badge>
            {meta?.availabilityFiltered && (
              <Badge variant="secondary" className="bg-green-500/80 text-white">
                {language === 'ru' ? 'Проверено' : 'Verified'}
              </Badge>
            )}
            {meta?.cached && (
              <Badge variant="secondary" className="bg-blue-500/80 text-white text-xs">
                Cached
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold">
            {language === 'ru' ? 'Результаты поиска' : 'Search Results'}
          </h1>
          
          {/* Active Filters */}
          {(dateRange.from && dateRange.to) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge className="bg-white text-teal-700 hover:bg-white/90 flex items-center gap-2 px-3 py-1 transition-colors">
                <CalendarIcon className="h-4 w-4" />
                {format(dateRange.from, 'd MMM', { locale })} — {format(dateRange.to, 'd MMM', { locale })}
                <span className="text-teal-500">({nights} {language === 'ru' ? 'н.' : 'n.'})</span>
                <button onClick={clearDates} className="ml-1 hover:text-red-600 transition-colors">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
              {guests !== '1' && (
                <Badge className="bg-white text-teal-700">
                  <Users className="h-4 w-4 mr-1" />
                  {guests} {language === 'ru' ? 'гостей' : 'guests'}
                </Badge>
              )}
              {selectedDistrict !== 'all' && (
                <Badge className="bg-white text-teal-700">
                  <MapPin className="h-4 w-4 mr-1" />
                  {selectedDistrict}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b sticky top-12 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {/* Search */}
            <div className="col-span-2 md:col-span-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder={language === 'ru' ? 'Поиск...' : 'Search...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-9"
                data-testid="listings-search-input"
              />
            </div>

            {/* Date Picker - Using SearchCalendar */}
            <SearchCalendar
              value={dateRange}
              onChange={setDateRange}
              locale={language}
              placeholder={language === 'ru' ? 'Даты' : 'Dates'}
              className="h-9 border rounded-md justify-start px-3"
            />

            {/* District */}
            <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
              <SelectTrigger className="h-9" data-testid="listings-district-select">
                <MapPin className="h-4 w-4 mr-2 text-teal-600" />
                <span className="truncate">
                  {selectedDistrict === 'all' ? (language === 'ru' ? 'Район' : 'District') : selectedDistrict}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === 'ru' ? 'Все районы' : 'All districts'}</SelectItem>
                {DISTRICTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>

            {/* Guests */}
            <Select value={guests} onValueChange={setGuests}>
              <SelectTrigger className="h-9" data-testid="listings-guests-select">
                <Users className="h-4 w-4 mr-2 text-teal-600" />
                <span>{guests} {language === 'ru' ? 'гостей' : 'guests'}</span>
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map(n => (
                  <SelectItem key={n} value={String(n)}>{n} {language === 'ru' ? 'гостей' : 'guests'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="container mx-auto px-4 py-6">
        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center mb-6">
            <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-red-700 mb-2">
              {language === 'ru' ? 'Ошибка загрузки' : 'Loading Error'}
            </h3>
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={retry} variant="outline" className="border-red-300 text-red-700 hover:bg-red-100">
              <RefreshCw className="h-4 w-4 mr-2" />
              {language === 'ru' ? 'Повторить' : 'Retry'}
            </Button>
          </div>
        )}

        {/* Skeleton Loading State */}
        {loading && !error ? (
          <ListingGridSkeleton count={8} />
        ) : !error && listings.length === 0 ? (
          /* Empty State */
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🏠</div>
            <h3 className="text-xl font-semibold mb-2">
              {language === 'ru' ? 'Ничего не найдено' : 'No results found'}
            </h3>
            <p className="text-slate-500 mb-4">
              {meta?.filteredOutByAvailability > 0 
                ? (language === 'ru' 
                    ? `${meta.filteredOutByAvailability} объектов недоступны на выбранные даты`
                    : `${meta.filteredOutByAvailability} listings unavailable for selected dates`)
                : (language === 'ru' ? 'Попробуйте изменить фильтры' : 'Try changing your filters')}
            </p>
            {dateRange.from && (
              <Button variant="outline" onClick={clearDates}>
                {language === 'ru' ? 'Сбросить даты' : 'Clear dates'}
              </Button>
            )}
          </div>
        ) : !error && (
          <>
            {/* Results Grid with Animation */}
            <div 
              className={cn(
                "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 transition-opacity duration-200",
                isTransitioning ? "opacity-50" : "opacity-100"
              )}
            >
              {listings.map((listing, index) => (
                <div
                  key={listing.id}
                  className="animate-in fade-in slide-in-from-bottom-4 duration-300"
                  style={{ animationDelay: `${Math.min(index * 50, 300)}ms` }}
                >
                  <GostayloListingCard 
                    listing={listing}
                    initialDates={cardDates}
                    guests={guests}
                    language={language}
                    currency={currency}
                    exchangeRates={exchangeRates}
                  />
                </div>
              ))}
            </div>

            {/* Load More / Infinite Scroll Trigger */}
            {hasMore && (
              <div 
                ref={loadMoreRef}
                className="flex justify-center py-8"
              >
                {loadingMore ? (
                  <div className="flex items-center gap-2 text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>{language === 'ru' ? 'Загрузка...' : 'Loading more...'}</span>
                  </div>
                ) : (
                  <Button 
                    variant="outline" 
                    onClick={loadMore}
                    className="border-teal-300 text-teal-700 hover:bg-teal-50"
                  >
                    {language === 'ru' ? 'Показать ещё' : 'Load more'} ({allListings.length - displayedCount} {language === 'ru' ? 'ещё' : 'more'})
                  </Button>
                )}
              </div>
            )}

            {/* Results Info */}
            {!hasMore && listings.length > 0 && (
              <div className="text-center py-6 text-slate-400 text-sm">
                {language === 'ru' 
                  ? `Показано ${listings.length} из ${allListings.length} объектов`
                  : `Showing ${listings.length} of ${allListings.length} properties`}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function ListingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    }>
      <ListingsContent />
    </Suspense>
  )
}
