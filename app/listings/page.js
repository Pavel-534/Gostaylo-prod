'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Home, Bike, Map, Anchor, Search, ArrowLeft, Star, MapPin, Grid, List, Loader2, CalendarIcon, Users, X } from 'lucide-react'
import { formatPrice } from '@/lib/currency'
import { fetchExchangeRates } from '@/lib/client-data'
import { getUIText, getCategoryName, getListingText } from '@/lib/translations'
import { DayPicker } from 'react-day-picker'
import { format, parseISO, isSameDay, differenceInDays } from 'date-fns'
import { ru, enUS } from 'date-fns/locale'

// Debounce hook
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
  
  // Read initial values from URL
  const initialCategory = searchParams.get('category') || 'all'
  const initialLocation = searchParams.get('location') || 'all'
  const initialCheckIn = searchParams.get('checkIn')
  const initialCheckOut = searchParams.get('checkOut')
  const initialGuests = searchParams.get('guests') || '1'
  const initialQuery = searchParams.get('q') || ''
  
  // State
  const [listings, setListings] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const [selectedCategory, setSelectedCategory] = useState(initialCategory)
  const [selectedDistrict, setSelectedDistrict] = useState(initialLocation)
  const [sortBy, setSortBy] = useState('newest')
  const [viewMode, setViewMode] = useState('grid')
  const [language, setLanguage] = useState('en')
  const [currency, setCurrency] = useState('THB')
  const [exchangeRates, setExchangeRates] = useState({ THB: 1, USD: 35.5, RUB: 0.37 })
  const [guests, setGuests] = useState(initialGuests)
  const [dateRange, setDateRange] = useState({
    from: initialCheckIn ? parseISO(initialCheckIn) : null,
    to: initialCheckOut ? parseISO(initialCheckOut) : null
  })
  const [meta, setMeta] = useState(null)

  const districts = ['Patong', 'Kata', 'Karon', 'Kamala', 'Rawai', 'Phuket Town', 'Bang Tao', 'Chalong', 'Nai Harn', 'Panwa', 'Mai Khao', 'Nai Yang', 'Surin']

  const categoryIcons = {
    property: Home,
    vehicles: Bike,
    tours: Map,
    yachts: Anchor,
  }

  // Debounced search query for API calls
  const debouncedQuery = useDebounce(searchQuery, 300)

  // Load initial data
  useEffect(() => {
    const storedLang = localStorage.getItem('gostaylo_language')
    if (storedLang) {
      setLanguage(storedLang)
    } else {
      const browserLang = navigator.language.split('-')[0]
      const supported = ['ru', 'en', 'zh', 'th']
      setLanguage(supported.includes(browserLang) ? browserLang : 'en')
    }
    
    const storedCurrency = localStorage.getItem('gostaylo_currency')
    if (storedCurrency) setCurrency(storedCurrency)
    
    // Load categories
    loadCategories()
    // Load exchange rates
    fetchExchangeRates().then(setExchangeRates).catch(console.error)
  }, [])

  // Listen for currency changes
  useEffect(() => {
    const handleCurrencyChange = (e) => setCurrency(e.detail)
    window.addEventListener('currency-change', handleCurrencyChange)
    return () => window.removeEventListener('currency-change', handleCurrencyChange)
  }, [])

  // Fetch listings when filters change (debounced)
  useEffect(() => {
    fetchListingsFromAPI()
  }, [debouncedQuery, selectedCategory, selectedDistrict, dateRange, guests])

  // Update URL when filters change
  const updateURL = useCallback(() => {
    const params = new URLSearchParams()
    
    if (debouncedQuery) params.set('q', debouncedQuery)
    if (selectedCategory && selectedCategory !== 'all') params.set('category', selectedCategory)
    if (selectedDistrict && selectedDistrict !== 'all') params.set('location', selectedDistrict)
    if (dateRange.from) params.set('checkIn', format(dateRange.from, 'yyyy-MM-dd'))
    if (dateRange.to && !isSameDay(dateRange.from, dateRange.to)) params.set('checkOut', format(dateRange.to, 'yyyy-MM-dd'))
    if (guests && guests !== '1') params.set('guests', guests)
    
    const queryString = params.toString()
    const url = queryString ? `/listings?${queryString}` : '/listings'
    
    // Update URL without navigation
    window.history.replaceState({}, '', url)
  }, [debouncedQuery, selectedCategory, selectedDistrict, dateRange, guests])

  useEffect(() => {
    updateURL()
  }, [updateURL])

  async function loadCategories() {
    try {
      const res = await fetch('/api/v2/categories')
      const data = await res.json()
      if (data.success) {
        setCategories(data.data || [])
      }
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }

  async function fetchListingsFromAPI() {
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
        console.error('Search API error:', data.error)
        setListings([])
      }
    } catch (error) {
      console.error('Failed to fetch listings:', error)
      setListings([])
    } finally {
      setLoading(false)
    }
  }

  // Clear date filter
  const clearDates = () => {
    setDateRange({ from: null, to: null })
  }

  // Sort listings
  const sortedListings = [...listings].sort((a, b) => {
    switch (sortBy) {
      case 'price_asc':
        return (a.basePriceThb || 0) - (b.basePriceThb || 0)
      case 'price_desc':
        return (b.basePriceThb || 0) - (a.basePriceThb || 0)
      case 'rating':
        return (b.rating || 0) - (a.rating || 0)
      case 'newest':
      default:
        return new Date(b.createdAt) - new Date(a.createdAt)
    }
  })

  // Build listing URL with date params
  const getListingUrl = (listing) => {
    const params = new URLSearchParams()
    if (dateRange.from) params.set('checkIn', format(dateRange.from, 'yyyy-MM-dd'))
    if (dateRange.to) params.set('checkOut', format(dateRange.to, 'yyyy-MM-dd'))
    if (guests && guests !== '1') params.set('guests', guests)
    
    const queryString = params.toString()
    return queryString ? `/listings/${listing.id}?${queryString}` : `/listings/${listing.id}`
  }

  // Calculate nights for display
  const nights = dateRange.from && dateRange.to ? differenceInDays(dateRange.to, dateRange.from) : 0

  const locale = language === 'ru' ? ru : enUS

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-teal-600">
            <ArrowLeft className="h-5 w-5" />
            <span>{language === 'ru' ? 'На главную' : 'Back to Home'}</span>
          </Link>
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center text-white font-bold">G</div>
            <span className="font-semibold text-lg">Gostaylo</span>
          </Link>
        </div>
      </div>

      {/* Hero with Active Filters */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="bg-white/20 text-white">
              {loading ? '...' : `${sortedListings.length} ${language === 'ru' ? 'объектов' : 'objects'}`}
            </Badge>
            {meta?.availabilityFiltered && (
              <Badge variant="secondary" className="bg-green-500/80 text-white">
                {language === 'ru' ? 'Проверено' : 'Verified available'}
              </Badge>
            )}
          </div>
          <h1 className="text-3xl font-bold mb-1">
            {selectedCategory !== 'all' 
              ? getCategoryName(selectedCategory, language, selectedCategory)
              : (language === 'ru' ? 'Все категории' : 'All categories')}
          </h1>
          <p className="text-white/80">
            {language === 'ru' ? 'Найдите идеальный вариант для вашего отдыха' : 'Find the perfect option for your vacation'}
          </p>
          
          {/* Active Date Filter Display */}
          {dateRange.from && dateRange.to && (
            <div className="mt-4 flex items-center gap-2">
              <Badge className="bg-white text-teal-700 hover:bg-white/90 flex items-center gap-2 px-3 py-1">
                <CalendarIcon className="h-4 w-4" />
                {format(dateRange.from, 'd MMM', { locale })} — {format(dateRange.to, 'd MMM', { locale })}
                ({nights} {language === 'ru' ? (nights === 1 ? 'ночь' : nights < 5 ? 'ночи' : 'ночей') : `night${nights > 1 ? 's' : ''}`})
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
            </div>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border-b sticky top-14 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            {/* Search Input */}
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder={language === 'ru' ? 'Поиск...' : 'Search...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Date Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
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
                  numberOfMonths={1}
                  disabled={{ before: new Date() }}
                />
              </PopoverContent>
            </Popover>

            {/* District */}
            <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
              <SelectTrigger>
                <MapPin className="h-4 w-4 mr-2 text-slate-400" />
                <SelectValue placeholder={language === 'ru' ? 'Район' : 'District'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === 'ru' ? 'Все районы' : 'All districts'}</SelectItem>
                {districts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">{language === 'ru' ? 'Новые' : 'Newest'}</SelectItem>
                <SelectItem value="price_asc">{language === 'ru' ? 'Цена ↑' : 'Price ↑'}</SelectItem>
                <SelectItem value="price_desc">{language === 'ru' ? 'Цена ↓' : 'Price ↓'}</SelectItem>
                <SelectItem value="rating">{language === 'ru' ? 'Рейтинг' : 'Rating'}</SelectItem>
              </SelectContent>
            </Select>

            {/* View Toggle */}
            <div className="flex gap-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('grid')}
                className={viewMode === 'grid' ? 'bg-teal-600' : ''}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('list')}
                className={viewMode === 'list' ? 'bg-teal-600' : ''}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600 mb-4" />
            <p className="text-slate-500">{language === 'ru' ? 'Поиск...' : 'Searching...'}</p>
          </div>
        ) : sortedListings.length === 0 ? (
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
          <div className={viewMode === 'grid' 
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
            : 'flex flex-col gap-4'
          }>
            {sortedListings.map(listing => (
              <Link key={listing.id} href={getListingUrl(listing)}>
                <Card className={`overflow-hidden hover:shadow-lg transition-shadow cursor-pointer ${viewMode === 'list' ? 'flex flex-row' : ''}`}>
                  {/* Image */}
                  <div className={`relative ${viewMode === 'list' ? 'w-48 flex-shrink-0' : 'aspect-[4/3]'}`}>
                    {listing.coverImage || listing.images?.[0] ? (
                      <img
                        src={listing.coverImage || listing.images[0]}
                        alt={listing.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-200 flex items-center justify-center">
                        <Home className="h-12 w-12 text-slate-400" />
                      </div>
                    )}
                    {listing.isFeatured && (
                      <Badge className="absolute top-2 left-2 bg-orange-500">
                        ⭐ {language === 'ru' ? 'Топ' : 'Featured'}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Content */}
                  <CardContent className={`p-4 ${viewMode === 'list' ? 'flex-1' : ''}`}>
                    <h3 className="font-semibold text-lg line-clamp-1">{listing.title}</h3>
                    <p className="text-slate-500 text-sm line-clamp-1 mt-1">{listing.description}</p>
                    
                    <div className="flex items-center gap-1 mt-2 text-sm text-slate-500">
                      <MapPin className="h-4 w-4" />
                      <span>{listing.district || 'Phuket'}</span>
                    </div>
                    
                    {listing.rating > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-medium">{listing.rating.toFixed(1)}</span>
                        {listing.reviewsCount > 0 && (
                          <span className="text-sm text-slate-400">({listing.reviewsCount})</span>
                        )}
                      </div>
                    )}
                    
                    <div className="mt-3 flex items-baseline justify-between">
                      <div>
                        <span className="text-xl font-bold text-teal-600">
                          {formatPrice(listing.basePriceThb, currency, exchangeRates)}
                        </span>
                        <span className="text-slate-500 text-sm">/{language === 'ru' ? 'ночь' : 'night'}</span>
                      </div>
                      
                      {/* Show total price if dates selected */}
                      {listing.pricing && nights > 0 && (
                        <div className="text-right">
                          <div className="text-sm text-slate-500">
                            {nights} {language === 'ru' ? 'ночей' : 'nights'}
                          </div>
                          <div className="text-sm font-semibold text-teal-700">
                            {formatPrice(listing.pricing.totalPrice, currency, exchangeRates)}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <Button className="w-full mt-3 bg-teal-600 hover:bg-teal-700">
                      {language === 'ru' ? 'Забронировать' : 'Book now'}
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ListingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    }>
      <ListingsContent />
    </Suspense>
  )
}
