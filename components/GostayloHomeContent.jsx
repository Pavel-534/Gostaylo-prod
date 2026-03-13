'use client'

/**
 * GostayloHomeContent - Home Page with Unified Calendar
 * 
 * REFACTORED: Removed react-day-picker, using SearchCalendar component
 * 
 * @updated 2026-03-13
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, MapPin, Home, Bike, Map, Anchor, Loader2, BedDouble, Bath, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from '@/components/ui/drawer'
import { formatPrice } from '@/lib/currency'
import { fetchCategories, fetchExchangeRates, fetchDistricts } from '@/lib/client-data'
import { detectLanguage, getCategoryName, getUIText, getListingText } from '@/lib/translations'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'
import { SearchCalendar } from '@/components/search-calendar'
import { ListingGridSkeleton } from '@/components/listing-card-skeleton'
import { format, isSameDay, differenceInDays } from 'date-fns'
import { ru, enUS } from 'date-fns/locale'

// Phuket districts
const PHUKET_DISTRICTS = [
  'Patong', 'Kata', 'Karon', 'Kamala', 'Surin', 'Bang Tao', 
  'Rawai', 'Chalong', 'Nai Harn', 'Mai Khao', 'Nai Yang', 'Panwa'
]

// Debounce hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

// Media query hook
function useMediaQuery(query) {
  const getMatches = (q) => typeof window !== 'undefined' ? window.matchMedia(q).matches : false
  const [matches, setMatches] = useState(() => getMatches(query))
  
  useEffect(() => {
    const media = window.matchMedia(query)
    const listener = (e) => setMatches(e.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [query])
  
  return matches
}

export function GostayloHomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user: authUser, openLoginModal } = useAuth()
  const isMobile = useMediaQuery('(max-width: 768px)')
  
  // Core state
  const [currency, setCurrency] = useState('THB')
  const [language, setLanguageState] = useState('ru')
  const [categories, setCategories] = useState([])
  const [listings, setListings] = useState([])
  const [districts, setDistricts] = useState([])
  const [exchangeRates, setExchangeRates] = useState({})
  const [loading, setLoading] = useState(true)
  const [listingsLoading, setListingsLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  
  // Search filters
  const [selectedDistrict, setSelectedDistrict] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateRange, setDateRange] = useState({ from: null, to: null })
  const [guests, setGuests] = useState('2')
  
  // Drawer states (mobile)
  const [locationDrawerOpen, setLocationDrawerOpen] = useState(false)
  const [guestsDrawerOpen, setGuestsDrawerOpen] = useState(false)
  
  // Temp states for drawers
  const [tempDistrict, setTempDistrict] = useState('all')
  const [tempGuests, setTempGuests] = useState('2')
  
  // Live counter
  const [liveCount, setLiveCount] = useState(null)
  const [countLoading, setCountLoading] = useState(false)
  
  // Debounced values
  const debouncedDateRange = useDebounce(dateRange, 500)
  const debouncedDistrict = useDebounce(selectedDistrict, 300)
  const debouncedGuests = useDebounce(guests, 300)

  // Sync user from auth context
  useEffect(() => {
    if (authUser) {
      setCurrentUser(authUser)
    } else if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('gostaylo_user')
      if (stored) {
        try { setCurrentUser(JSON.parse(stored)) } catch (e) { /* ignore */ }
      }
    }
  }, [authUser])
  
  // Handle URL params
  useEffect(() => {
    if (searchParams?.get('login') === 'true') {
      openLoginModal?.('login')
      window.history.replaceState({}, '', '/')
    }
    if (searchParams?.get('verified') === 'success') {
      toast.success(language === 'ru' ? 'Email подтверждён!' : 'Email verified!')
      window.history.replaceState({}, '', '/')
      fetch('/api/v2/auth/me', { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          if (data.success && data.user) {
            setCurrentUser(data.user)
            localStorage.setItem('gostaylo_user', JSON.stringify(data.user))
          }
        })
    }
    if (searchParams?.get('auth_error')) {
      toast.error(language === 'ru' ? 'Ошибка авторизации' : 'Auth error')
      window.history.replaceState({}, '', '/')
    }
  }, [searchParams, language, openLoginModal])

  useEffect(() => {
    setLanguageState(detectLanguage())
  }, [])

  // Currency sync
  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedCurrency = localStorage.getItem('gostaylo_currency')
    if (savedCurrency) setCurrency(savedCurrency)
    const handleCurrencyChange = (e) => setCurrency(e.detail)
    window.addEventListener('currency-change', handleCurrencyChange)
    return () => window.removeEventListener('currency-change', handleCurrencyChange)
  }, [])

  // Initial data load
  useEffect(() => {
    async function loadInitialData() {
      const [cats, rates, dists] = await Promise.all([
        fetchCategories(),
        fetchExchangeRates(),
        fetchDistricts()
      ])
      setCategories(cats)
      setExchangeRates(rates)
      setDistricts(dists)
    }
    loadInitialData().catch(console.error)
  }, [])

  // Fetch listings from API
  const fetchListingsData = useCallback(async (showLoading = true) => {
    if (showLoading) setListingsLoading(true)
    
    try {
      const params = new URLSearchParams({ limit: '12', featured: 'true' })
      if (selectedDistrict && selectedDistrict !== 'all') params.set('location', selectedDistrict)
      if (dateRange.from && dateRange.to && !isSameDay(dateRange.from, dateRange.to)) {
        params.set('checkIn', format(dateRange.from, 'yyyy-MM-dd'))
        params.set('checkOut', format(dateRange.to, 'yyyy-MM-dd'))
      }
      if (guests && guests !== '1') params.set('guests', guests)
      
      const response = await fetch(`/api/v2/search?${params.toString()}`)
      const data = await response.json()
      
      if (data.success) {
        setListings(data.data.listings)
        return data.data.meta.available
      }
    } catch (error) {
      console.error('Listings fetch error:', error)
    } finally {
      setListingsLoading(false)
      setLoading(false)
    }
    return 0
  }, [selectedDistrict, dateRange, guests])

  // Initial load
  useEffect(() => {
    fetchListingsData()
  }, [fetchListingsData])

  // Live updates
  useEffect(() => {
    if (!loading) fetchListingsData(false)
  }, [debouncedDateRange, debouncedDistrict, debouncedGuests, loading, fetchListingsData])

  // Live count fetch for drawers
  const fetchLiveCount = useCallback(async (dr, dist, g) => {
    setCountLoading(true)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (dist && dist !== 'all') params.set('location', dist)
      if (dr?.from && dr?.to && !isSameDay(dr.from, dr.to)) {
        params.set('checkIn', format(dr.from, 'yyyy-MM-dd'))
        params.set('checkOut', format(dr.to, 'yyyy-MM-dd'))
      }
      if (g && g !== '1') params.set('guests', g)
      
      const response = await fetch(`/api/v2/search?${params.toString()}`)
      const data = await response.json()
      if (data.success) setLiveCount(data.data.meta.available)
    } catch (e) {
      console.error('Live count error:', e)
    } finally {
      setCountLoading(false)
    }
  }, [])

  // Drawer effects for live count
  useEffect(() => {
    if (locationDrawerOpen) {
      setTempDistrict(selectedDistrict)
      fetchLiveCount(dateRange, selectedDistrict, guests)
    }
  }, [locationDrawerOpen, dateRange, selectedDistrict, guests, fetchLiveCount])

  useEffect(() => {
    if (guestsDrawerOpen) {
      setTempGuests(guests)
      fetchLiveCount(dateRange, selectedDistrict, guests)
    }
  }, [guestsDrawerOpen, dateRange, selectedDistrict, guests, fetchLiveCount])

  // Debounced temp values for live count
  const debouncedTempDistrict = useDebounce(tempDistrict, 300)
  const debouncedTempGuests = useDebounce(tempGuests, 300)

  useEffect(() => {
    if (locationDrawerOpen) {
      fetchLiveCount(dateRange, debouncedTempDistrict, guests)
    }
  }, [locationDrawerOpen, dateRange, debouncedTempDistrict, guests, fetchLiveCount])

  useEffect(() => {
    if (guestsDrawerOpen) {
      fetchLiveCount(dateRange, selectedDistrict, debouncedTempGuests)
    }
  }, [guestsDrawerOpen, dateRange, selectedDistrict, debouncedTempGuests, fetchLiveCount])

  // Price conversion
  const convertPrice = useCallback((priceThb) => {
    if (!priceThb) return 0
    if (currency === 'THB') return priceThb
    const rate = exchangeRates[currency]
    return rate ? priceThb / rate : priceThb
  }, [currency, exchangeRates])

  const categoryIcons = { property: Home, vehicles: Bike, tours: Map, yachts: Anchor }

  // URL Bridge Search
  const handleSearch = useCallback(() => {
    const params = new URLSearchParams()
    if (searchQuery.trim()) params.set('q', searchQuery.trim())
    if (selectedDistrict && selectedDistrict !== 'all') params.set('location', selectedDistrict)
    if (dateRange.from) params.set('checkIn', format(dateRange.from, 'yyyy-MM-dd'))
    if (dateRange.to && !isSameDay(dateRange.from, dateRange.to)) params.set('checkOut', format(dateRange.to, 'yyyy-MM-dd'))
    if (guests && guests !== '1') params.set('guests', guests)
    router.push(params.toString() ? `/listings?${params.toString()}` : '/listings')
  }, [searchQuery, selectedDistrict, dateRange, guests, router])

  const nights = dateRange.from && dateRange.to ? differenceInDays(dateRange.to, dateRange.from) : 0
  const locale = language === 'ru' ? ru : enUS

  // Drawer confirm handlers
  const confirmDistrict = useCallback(() => {
    setSelectedDistrict(tempDistrict)
    setLocationDrawerOpen(false)
  }, [tempDistrict])

  const confirmGuests = useCallback(() => {
    setGuests(tempGuests)
    setGuestsDrawerOpen(false)
  }, [tempGuests])

  // Drawer button text
  const drawerButtonText = useMemo(() => {
    const count = liveCount !== null ? liveCount : ''
    return `${language === 'ru' ? 'Показать' : 'Show'} ${count} ${language === 'ru' ? 'вариантов' : 'options'}`
  }, [liveCount, language])

  // Handle calendar date change with live count update
  const handleDateChange = useCallback((newRange) => {
    setDateRange(newRange)
    if (newRange.from && newRange.to) {
      fetchLiveCount(newRange, selectedDistrict, guests)
    }
  }, [selectedDistrict, guests, fetchLiveCount])

  return (
    <div className='min-h-screen bg-white'>
      {/* Hero Section */}
      <section className='relative pt-14 min-h-[500px] sm:min-h-[580px] bg-cover bg-center' style={{ backgroundImage: 'url(https://images.pexels.com/photos/33607600/pexels-photo-33607600.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940)' }}>
        <div className='absolute inset-0 bg-gradient-to-r from-slate-900/80 to-slate-900/40' />
        <div className='relative container mx-auto px-4 min-h-[440px] sm:min-h-[510px] flex flex-col justify-center'>
          <div className='max-w-3xl mx-auto sm:mx-0'>
            <h1 className='text-3xl sm:text-5xl md:text-6xl font-bold text-white mb-4 text-center sm:text-left'>
              {getUIText('heroTitle', language)}
              <span className='block text-teal-400'>{getUIText('heroTitleHighlight', language)}</span>
            </h1>
            <p className='text-base sm:text-xl text-slate-200 mb-6 sm:mb-8 text-center sm:text-left'>
              {getUIText('heroSubtitle', language)}
            </p>

            {/* Monolithic Search Bar */}
            <div className='bg-white rounded-full shadow-2xl overflow-hidden border border-slate-200'>
              {/* Desktop */}
              <div className='hidden md:flex items-center'>
                <div className='flex items-center gap-2 px-5 py-3 flex-1 min-w-0 border-r border-slate-200'>
                  <Search className='h-4 w-4 text-teal-600 flex-shrink-0' />
                  <input
                    type="text"
                    placeholder={language === 'ru' ? 'Поиск...' : 'Search...'}
                    className='w-full text-sm outline-none bg-transparent text-slate-700 placeholder:text-slate-400'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    data-testid="search-input"
                  />
                </div>
                
                {/* Date Picker - Using SearchCalendar */}
                <div className='border-r border-slate-200'>
                  <SearchCalendar
                    value={dateRange}
                    onChange={handleDateChange}
                    locale={language}
                    placeholder={language === 'ru' ? 'Даты' : 'Dates'}
                    liveCount={liveCount}
                    countLoading={countLoading}
                  />
                </div>
                
                {/* Location */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button className='flex items-center gap-2 px-4 py-3 border-r border-slate-200 hover:bg-slate-50 transition-colors'>
                      <MapPin className='h-4 w-4 text-teal-600' />
                      <span className='text-sm text-slate-700'>{selectedDistrict === 'all' ? (language === 'ru' ? 'Район' : 'District') : selectedDistrict}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2" align="start">
                    <div className="space-y-1">
                      <button onClick={() => setSelectedDistrict('all')} className={`w-full text-left px-3 py-2 rounded-md text-sm ${selectedDistrict === 'all' ? 'bg-teal-50 text-teal-700' : 'hover:bg-slate-100'}`}>
                        {language === 'ru' ? 'Все районы' : 'All districts'}
                      </button>
                      {districts.map(d => (
                        <button key={d} onClick={() => setSelectedDistrict(d)} className={`w-full text-left px-3 py-2 rounded-md text-sm ${selectedDistrict === d ? 'bg-teal-50 text-teal-700' : 'hover:bg-slate-100'}`}>{d}</button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                
                {/* Guests */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button className='flex items-center gap-2 px-4 py-3 border-r border-slate-200 hover:bg-slate-50 transition-colors'>
                      <Users className='h-4 w-4 text-teal-600' />
                      <span className='text-sm text-slate-700'>{guests}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2" align="start">
                    <div className="grid grid-cols-5 gap-1">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map(n => (
                        <button key={n} onClick={() => setGuests(String(n))} className={`p-2 rounded text-sm ${guests === String(n) ? 'bg-teal-600 text-white' : 'hover:bg-slate-100'}`}>{n}</button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                
                <Button onClick={handleSearch} className='h-12 px-6 rounded-full bg-teal-600 hover:bg-teal-700 m-1' data-testid="search-button">
                  <Search className='h-4 w-4 mr-2' />{language === 'ru' ? 'Найти' : 'Search'}
                </Button>
              </div>
              
              {/* Mobile */}
              <div className='md:hidden flex items-center p-1'>
                {/* Mobile Date - Using SearchCalendar with built-in drawer */}
                <div className='flex-1 border-r border-slate-200'>
                  <SearchCalendar
                    value={dateRange}
                    onChange={handleDateChange}
                    locale={language}
                    placeholder={nights > 0 ? `${nights}н.` : (language === 'ru' ? 'Даты' : 'Dates')}
                    liveCount={liveCount}
                    countLoading={countLoading}
                    className="justify-center py-3"
                  />
                </div>
                
                <button onClick={() => setLocationDrawerOpen(true)} className='flex-1 flex items-center justify-center gap-2 py-3 border-r border-slate-200' data-testid="mobile-location-trigger">
                  <MapPin className='h-4 w-4 text-teal-600' />
                  <span className='text-xs text-slate-700 truncate max-w-[60px]'>{selectedDistrict === 'all' ? (language === 'ru' ? 'Район' : 'Area') : selectedDistrict}</span>
                </button>
                <button onClick={() => setGuestsDrawerOpen(true)} className='flex-1 flex items-center justify-center gap-2 py-3 border-r border-slate-200' data-testid="mobile-guests-trigger">
                  <Users className='h-4 w-4 text-teal-600' />
                  <span className='text-xs text-slate-700'>{guests}</span>
                </button>
                <Button onClick={handleSearch} size="icon" className='h-10 w-10 rounded-full bg-teal-600 hover:bg-teal-700 mx-1' data-testid="mobile-search-button">
                  <Search className='h-4 w-4' />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Mobile Location Drawer */}
      <Drawer open={locationDrawerOpen} onOpenChange={setLocationDrawerOpen}>
        <DrawerContent className="h-[70vh] max-h-[70vh]">
          <DrawerHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <DrawerTitle>{language === 'ru' ? 'Район Пхукета' : 'Phuket District'}</DrawerTitle>
              <DrawerClose asChild><Button variant="ghost" size="icon"><X className="h-5 w-5" /></Button></DrawerClose>
            </div>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setTempDistrict('all')} className={`p-3 rounded-lg border text-left transition-all ${tempDistrict === 'all' ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-slate-200 hover:border-slate-300'}`}>
                <span className="font-medium">{language === 'ru' ? 'Все районы' : 'All districts'}</span>
              </button>
              {PHUKET_DISTRICTS.map(district => (
                <button key={district} onClick={() => setTempDistrict(district)} className={`p-3 rounded-lg border text-left transition-all ${tempDistrict === district ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-slate-200 hover:border-slate-300'}`}>
                  <span className="font-medium">{district}</span>
                </button>
              ))}
            </div>
          </div>
          <DrawerFooter className="border-t pt-4">
            <Button className="w-full h-11 bg-teal-600 hover:bg-teal-700" onClick={confirmDistrict} data-testid="drawer-confirm-location">
              {countLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {drawerButtonText}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Mobile Guests Drawer */}
      <Drawer open={guestsDrawerOpen} onOpenChange={setGuestsDrawerOpen}>
        <DrawerContent className="h-[50vh] max-h-[50vh]">
          <DrawerHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <DrawerTitle>{language === 'ru' ? 'Количество гостей' : 'Number of guests'}</DrawerTitle>
              <DrawerClose asChild><Button variant="ghost" size="icon"><X className="h-5 w-5" /></Button></DrawerClose>
            </div>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map(num => (
                <button key={num} onClick={() => setTempGuests(String(num))} className={`p-4 rounded-lg border text-center transition-all ${tempGuests === String(num) ? 'border-teal-600 bg-teal-50 text-teal-700 font-bold' : 'border-slate-200 hover:border-slate-300'}`}>{num}</button>
              ))}
            </div>
          </div>
          <DrawerFooter className="border-t pt-4">
            <Button className="w-full h-11 bg-teal-600 hover:bg-teal-700" onClick={confirmGuests} data-testid="drawer-confirm-guests">
              {countLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {drawerButtonText}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Categories Section */}
      <section className='py-10 sm:py-14 bg-white'>
        <div className='container mx-auto px-4'>
          <h2 className='text-xl sm:text-2xl font-bold text-slate-900 mb-6 text-center sm:text-left'>{getUIText('categories', language)}</h2>
          <div className='grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4'>
            {categories.map((cat, idx) => {
              const Icon = categoryIcons[cat.slug] || Home
              const images = [
                'https://images.pexels.com/photos/33607600/pexels-photo-33607600.jpeg',
                'https://images.pexels.com/photos/31342032/pexels-photo-31342032.jpeg',
                'https://images.pexels.com/photos/18277777/pexels-photo-18277777.jpeg',
                'https://images.unsplash.com/photo-1566735201951-bc1cbeeb2964',
              ]
              return (
                <Card key={cat.id} className='group cursor-pointer overflow-hidden hover:shadow-lg transition-all border hover:border-teal-500' onClick={() => router.push(`/listings?category=${cat.slug}`)}>
                  <div className='relative h-28 sm:h-40 overflow-hidden'>
                    <img src={images[idx]} alt={cat.name} className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-300' />
                    <div className='absolute inset-0 bg-gradient-to-t from-slate-900/70 to-transparent' />
                    <div className='absolute bottom-2 left-2 right-2'>
                      <div className='flex items-center gap-1.5 text-white'>
                        <Icon className='h-4 w-4' />
                        <h3 className='text-sm sm:text-base font-bold'>{getCategoryName(cat.slug, language, cat.name)}</h3>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* Listings Section */}
      <section id='listings-section' className='py-10 sm:py-14 bg-slate-50'>
        <div className='container mx-auto px-4'>
          <div className='flex items-center justify-between mb-6'>
            <div>
              <h2 className='text-xl sm:text-2xl font-bold text-slate-900 mb-1'>
                {dateRange.from && dateRange.to ? (language === 'ru' ? 'Доступные объекты' : 'Available Properties') : (language === 'ru' ? 'Топ объекты' : 'Top Properties')}
              </h2>
              <p className='text-slate-500 text-sm'>
                {listings.length} {language === 'ru' ? 'объектов' : 'properties'}
                {dateRange.from && dateRange.to && <span className='text-teal-600 ml-2'>• {format(dateRange.from, 'd MMM', { locale })} — {format(dateRange.to, 'd MMM', { locale })}</span>}
              </p>
            </div>
            {listingsLoading && <Loader2 className='h-5 w-5 animate-spin text-teal-600' />}
          </div>

          {/* Skeleton Loading */}
          {loading ? (
            <ListingGridSkeleton count={8} />
          ) : listings.length === 0 ? (
            <div className='text-center py-12'><p className='text-slate-600'>{language === 'ru' ? 'Ничего не найдено' : 'No results'}</p></div>
          ) : (
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
              {listings.map(listing => {
                const listingParams = new URLSearchParams()
                if (dateRange.from) listingParams.set('checkIn', format(dateRange.from, 'yyyy-MM-dd'))
                if (dateRange.to && !isSameDay(dateRange.from, dateRange.to)) listingParams.set('checkOut', format(dateRange.to, 'yyyy-MM-dd'))
                if (guests !== '1') listingParams.set('guests', guests)
                const listingUrl = listingParams.toString() ? `/listings/${listing.id}?${listingParams.toString()}` : `/listings/${listing.id}`
                
                return (
                  <Link key={listing.id} href={listingUrl}>
                    <Card className='group h-full flex flex-col overflow-hidden hover:shadow-lg transition-all border hover:border-teal-400 bg-white'>
                      <div className='relative h-40 sm:h-44 overflow-hidden flex-shrink-0'>
                        <img src={listing.images?.[0] || '/placeholder.jpg'} alt={listing.title} className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-300' />
                        {listing.isFeatured && <Badge className='absolute top-2 left-2 bg-gradient-to-r from-purple-600 to-pink-600'>⭐ TOP</Badge>}
                        {listing.rating > 0 && <Badge className='absolute top-2 right-2 bg-teal-600'>⭐ {listing.rating}</Badge>}
                      </div>
                      <div className='flex flex-col flex-grow p-3'>
                        <h3 className='font-semibold text-slate-900 line-clamp-1 text-sm mb-1'>{getListingText(listing, 'title', language)}</h3>
                        <div className='flex items-center gap-1 text-xs text-slate-500 mb-2'>
                          <MapPin className='h-3 w-3' /><span>{listing.district}</span>
                        </div>
                        {(listing.bedrooms || listing.bathrooms) && (
                          <div className='flex items-center gap-3 text-xs text-slate-400 mb-2'>
                            {listing.bedrooms > 0 && <span className='flex items-center gap-0.5'><BedDouble className='h-3 w-3' />{listing.bedrooms}</span>}
                            {listing.bathrooms > 0 && <span className='flex items-center gap-0.5'><Bath className='h-3 w-3' />{listing.bathrooms}</span>}
                          </div>
                        )}
                        <div className='mt-auto flex items-baseline justify-between'>
                          <span className='text-lg font-bold text-teal-600'>{formatPrice(convertPrice(listing.pricing?.totalPrice || listing.basePriceThb), currency)}</span>
                          <span className='text-xs text-slate-400'>/{listing.pricing ? `${nights}н.` : (language === 'ru' ? 'ночь' : 'night')}</span>
                        </div>
                      </div>
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}
          
          {listings.length > 0 && (
            <div className='text-center mt-8'>
              <Button variant="outline" onClick={handleSearch} className='border-teal-600 text-teal-600 hover:bg-teal-50'>
                {language === 'ru' ? 'Смотреть все' : 'View all'} →
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className='bg-slate-900 text-white py-10'>
        <div className='container mx-auto px-4'>
          <div className='grid grid-cols-2 md:grid-cols-4 gap-6'>
            <div className='col-span-2 md:col-span-1'>
              <div className='flex flex-col leading-none mb-3'>
                <span className='text-xl font-black text-white tracking-tight'>Go</span>
                <span className='text-xl font-black text-teal-400 tracking-tight ml-4 -mt-1'>staylo</span>
              </div>
              <p className='text-slate-400 text-sm'>{getUIText('footerDesc', language)}</p>
            </div>
            <div>
              <h4 className='font-semibold mb-3 text-sm'>{getUIText('footerCategories', language)}</h4>
              <ul className='space-y-2 text-sm text-slate-400'>
                {categories.map(c => <li key={c.id}>{getCategoryName(c.slug, language, c.name)}</li>)}
              </ul>
            </div>
            <div>
              <h4 className='font-semibold mb-3 text-sm'>{getUIText('footerCompany', language)}</h4>
              <ul className='space-y-2 text-sm text-slate-400'>
                <li>{getUIText('aboutUs', language)}</li>
                <li>{getUIText('contactUs', language)}</li>
              </ul>
            </div>
            <div>
              <h4 className='font-semibold mb-3 text-sm'>{getUIText('footerSupport', language)}</h4>
              <ul className='space-y-2 text-sm text-slate-400'>
                <li>{getUIText('helpCenter', language)}</li>
                <li>{getUIText('terms', language)}</li>
              </ul>
            </div>
          </div>
          <div className='border-t border-slate-800 mt-8 pt-6 text-center text-sm text-slate-400'>
            <p>© 2025 Gostaylo. {getUIText('allRightsReserved', language)}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
