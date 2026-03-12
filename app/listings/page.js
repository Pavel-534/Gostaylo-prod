'use client'

/**
 * Gostaylo - Search Results Page (Sterilized)
 * 
 * All filtering is done server-side via /api/v2/search
 * Frontend only handles: display, URL sync, and user interactions
 * 
 * @sterilized 2026-03-12
 */

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Search, ArrowLeft, MapPin, Loader2, CalendarIcon, Users, X } from 'lucide-react'
import { formatPrice } from '@/lib/currency'
import { fetchExchangeRates } from '@/lib/client-data'
import { DayPicker } from 'react-day-picker'
import { format, parseISO, isSameDay, differenceInDays } from 'date-fns'
import { ru, enUS } from 'date-fns/locale'

// Phuket districts
const DISTRICTS = [
  'Patong', 'Kata', 'Karon', 'Kamala', 'Rawai', 'Chalong', 
  'Bang Tao', 'Nai Harn', 'Panwa', 'Mai Khao', 'Nai Yang', 'Surin'
]

// Debounce hook for search input
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

function ListingsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  // Read initial values from URL (Single Source of Truth)
  const initialCategory = searchParams.get('category') || 'all'
  const initialLocation = searchParams.get('location') || 'all'
  const initialCheckIn = searchParams.get('checkIn')
  const initialCheckOut = searchParams.get('checkOut')
  const initialGuests = searchParams.get('guests') || '2'
  const initialQuery = searchParams.get('q') || ''
  
  // Core state
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [meta, setMeta] = useState(null)
  
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

  // Debounced search for API calls
  const debouncedQuery = useDebounce(searchQuery, 300)

  // Initialize language and currency from storage
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

  // Listen for currency changes from header
  useEffect(() => {
    const handleCurrencyChange = (e) => setCurrency(e.detail)
    window.addEventListener('currency-change', handleCurrencyChange)
    return () => window.removeEventListener('currency-change', handleCurrencyChange)
  }, [])

  // =========================================================
  // SINGLE API FETCH - All filtering done server-side
  // =========================================================
  const fetchListings = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      
      if (debouncedQuery) params.set('q', debouncedQuery)
      if (selectedCategory && selectedCategory !== 'all') params.set('category', selectedCategory)
      if (selectedDistrict && selectedDistrict !== 'all') params.set('location', selectedDistrict)
      if (dateRange.from) params.set('checkIn', format(dateRange.from, 'yyyy-MM-dd'))
      if (dateRange.to && !isSameDay(dateRange.from, dateRange.to)) params.set('checkOut', format(dateRange.to, 'yyyy-MM-dd'))
      if (guests) params.set('guests', guests)
      
      const res = await fetch(`/api/v2/search?${params.toString()}`)
      const data = await res.json()
      
      if (data.success) {
        setListings(data.data.listings || [])
        setMeta(data.data.meta)
      } else {
        console.error('[LISTINGS] Search API error:', data.error)
        setListings([])
      }
    } catch (error) {
      console.error('[LISTINGS] Fetch error:', error)
      setListings([])
    } finally {
      setLoading(false)
    }
  }, [debouncedQuery, selectedCategory, selectedDistrict, dateRange, guests])

  // Fetch when filters change
  useEffect(() => {
    fetchListings()
  }, [fetchListings])

  // =========================================================
  // URL SYNC - Keep URL in sync with filter state
  // =========================================================
  const updateURL = useCallback(() => {
    const params = new URLSearchParams()
    
    if (debouncedQuery) params.set('q', debouncedQuery)
    if (selectedCategory && selectedCategory !== 'all') params.set('category', selectedCategory)
    if (selectedDistrict && selectedDistrict !== 'all') params.set('location', selectedDistrict)
    if (dateRange.from) params.set('checkIn', format(dateRange.from, 'yyyy-MM-dd'))
    if (dateRange.to && !isSameDay(dateRange.from, dateRange.to)) params.set('checkOut', format(dateRange.to, 'yyyy-MM-dd'))
    if (guests && guests !== '1') params.set('guests', guests)
    
    const url = params.toString() ? `/listings?${params.toString()}` : '/listings'
    window.history.replaceState({}, '', url)
  }, [debouncedQuery, selectedCategory, selectedDistrict, dateRange, guests])

  useEffect(() => {
    updateURL()
  }, [updateURL])

  // =========================================================
  // CONTEXT INHERITANCE - Build listing URL with search params
  // =========================================================
  const getListingUrl = useCallback((listing) => {
    const params = new URLSearchParams()
    if (dateRange.from) params.set('checkIn', format(dateRange.from, 'yyyy-MM-dd'))
    if (dateRange.to) params.set('checkOut', format(dateRange.to, 'yyyy-MM-dd'))
    if (guests && guests !== '1') params.set('guests', guests)
    
    const queryString = params.toString()
    return queryString ? `/listings/${listing.id}?${queryString}` : `/listings/${listing.id}`
  }, [dateRange, guests])

  // Clear dates helper
  const clearDates = () => setDateRange({ from: null, to: null })

  // Calculate nights for display
  const nights = dateRange.from && dateRange.to ? differenceInDays(dateRange.to, dateRange.from) : 0
  const locale = language === 'ru' ? ru : enUS

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-teal-600">
            <ArrowLeft className="h-5 w-5" />
            <span className="hidden sm:inline">{language === 'ru' ? 'На главную' : 'Back'}</span>
          </Link>
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center text-white font-bold">G</div>
            <span className="font-semibold text-lg hidden sm:inline">Gostaylo</span>
          </Link>
        </div>
      </div>

      {/* Hero with Results Count */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white py-6">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="bg-white/20 text-white">
              {loading ? '...' : `${listings.length} ${language === 'ru' ? 'объектов' : 'properties'}`}
            </Badge>
            {meta?.availabilityFiltered && (
              <Badge variant="secondary" className="bg-green-500/80 text-white">
                {language === 'ru' ? 'Проверено' : 'Verified'}
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold">
            {language === 'ru' ? 'Результаты поиска' : 'Search Results'}
          </h1>
          
          {/* Active Filters Display */}
          {(dateRange.from && dateRange.to) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge className="bg-white text-teal-700 hover:bg-white/90 flex items-center gap-2 px-3 py-1">
                <CalendarIcon className="h-4 w-4" />
                {format(dateRange.from, 'd MMM', { locale })} — {format(dateRange.to, 'd MMM', { locale })}
                <span className="text-teal-500">({nights} {language === 'ru' ? 'н.' : 'n.'})</span>
                <button onClick={clearDates} className="ml-1 hover:text-red-600">
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

      {/* Filters Bar */}
      <div className="bg-white border-b sticky top-12 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {/* Search Input */}
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

            {/* Date Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal h-9" data-testid="listings-date-picker">
                  <CalendarIcon className="mr-2 h-4 w-4 text-teal-600" />
                  {dateRange.from ? (
                    dateRange.to && !isSameDay(dateRange.from, dateRange.to) ? (
                      <span className="text-sm truncate">
                        {format(dateRange.from, 'd MMM', { locale })} — {format(dateRange.to, 'd MMM', { locale })}
                      </span>
                    ) : (
                      <span className="text-sm">{format(dateRange.from, 'd MMM', { locale })} — ...</span>
                    )
                  ) : (
                    <span className="text-muted-foreground text-sm">{language === 'ru' ? 'Даты' : 'Dates'}</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4" align="start">
                <DayPicker
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  locale={locale}
                  numberOfMonths={2}
                  disabled={{ before: new Date() }}
                  modifiersStyles={{ today: { fontWeight: 'bold' } }}
                  classNames={{
                    day_selected: 'bg-teal-600 text-white',
                    day_range_middle: 'bg-teal-100 text-teal-900',
                  }}
                />
                {dateRange.from && (
                  <div className="flex justify-end mt-2">
                    <Button variant="ghost" size="sm" onClick={clearDates} className="text-slate-500">
                      <X className="h-3 w-3 mr-1" />{language === 'ru' ? 'Сбросить' : 'Clear'}
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {/* District */}
            <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
              <SelectTrigger className="h-9" data-testid="listings-district-select">
                <MapPin className="h-4 w-4 mr-2 text-teal-600" />
                <span className="truncate">
                  {selectedDistrict === 'all' 
                    ? (language === 'ru' ? 'Район' : 'District') 
                    : selectedDistrict}
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

      {/* Results Grid */}
      <div className="container mx-auto px-4 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600 mb-4" />
            <p className="text-slate-500">{language === 'ru' ? 'Поиск...' : 'Searching...'}</p>
          </div>
        ) : listings.length === 0 ? (
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
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {/* 
              =========================================================
              PLACEHOLDER: GostayloListingCard will be inserted here
              Each listing comes from /api/v2/search with:
              - id, title, description, district, basePriceThb
              - images, coverImage
              - rating, reviewsCount
              - isFeatured
              - pricing (if dates selected): { totalPrice, nights, perNight }
              - metadata: { bedrooms, bathrooms, area, max_guests }
              =========================================================
            */}
            {listings.map(listing => (
              <GostayloListingCard 
                key={listing.id} 
                listing={listing}
                href={getListingUrl(listing)}
                nights={nights}
                language={language}
                currency={currency}
                exchangeRates={exchangeRates}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Placeholder component - Will be replaced with full implementation
 * Temporary inline card to prevent build errors
 */
function GostayloListingCard({ listing, href, nights, language, currency, exchangeRates }) {
  return (
    <Link href={href} data-testid={`listing-card-${listing.id}`}>
      <div className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-shadow border hover:border-teal-400">
        {/* Image */}
        <div className="relative aspect-[4/3]">
          <img
            src={listing.coverImage || listing.images?.[0] || '/placeholder.jpg'}
            alt={listing.title}
            className="w-full h-full object-cover"
          />
          {listing.isFeatured && (
            <span className="absolute top-2 left-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs px-2 py-1 rounded-full font-medium">
              ⭐ TOP
            </span>
          )}
          {listing.rating > 0 && (
            <span className="absolute top-2 right-2 bg-teal-600 text-white text-xs px-2 py-1 rounded-full font-medium">
              ⭐ {listing.rating.toFixed(1)}
            </span>
          )}
        </div>
        
        {/* Content */}
        <div className="p-3">
          <h3 className="font-semibold text-slate-900 line-clamp-1 text-sm">{listing.title}</h3>
          <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
            <MapPin className="h-3 w-3" />
            <span>{listing.district || 'Phuket'}</span>
          </div>
          
          {/* Price */}
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-lg font-bold text-teal-600">
              {formatPrice(listing.pricing?.totalPrice || listing.basePriceThb, currency, exchangeRates)}
            </span>
            <span className="text-xs text-slate-400">
              /{listing.pricing ? `${nights}н.` : (language === 'ru' ? 'ночь' : 'night')}
            </span>
          </div>
        </div>
      </div>
    </Link>
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
