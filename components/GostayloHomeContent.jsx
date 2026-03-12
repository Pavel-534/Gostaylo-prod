'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, MapPin, Home, Bike, Map, Anchor, User, Loader2, BedDouble, Bath, Maximize, Plus, Users, CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatPrice } from '@/lib/currency'
import { fetchCategories, fetchListings, fetchExchangeRates, fetchDistricts } from '@/lib/client-data'
import { detectLanguage, setLanguage as saveLanguage, supportedLanguages, getCategoryName, getUIText, getListingText } from '@/lib/translations'
import { CurrencySelector } from '@/components/currency-selector'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'
import { DayPicker } from 'react-day-picker'
import { format, isSameDay } from 'date-fns'
import { ru, enUS } from 'date-fns/locale'

export function GostayloHomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user: authUser, openLoginModal } = useAuth()
  
  // State
  const [currency, setCurrency] = useState('THB')
  const [language, setLanguageState] = useState('ru')
  const [categories, setCategories] = useState([])
  const [listings, setListings] = useState([])
  const [districts, setDistricts] = useState([])
  const [exchangeRates, setExchangeRates] = useState({})
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  
  // Search Filters (URL Bridge compatible)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedDistrict, setSelectedDistrict] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateRange, setDateRange] = useState({ from: null, to: null })
  const [guests, setGuests] = useState('1')

  // Sync user from auth context
  useEffect(() => {
    if (authUser) {
      setCurrentUser(authUser)
    } else {
      // Check localStorage as fallback
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('gostaylo_user')
        if (stored) {
          try {
            setCurrentUser(JSON.parse(stored))
          } catch {
            // Invalid JSON, ignore
          }
        }
      }
    }
  }, [authUser])
  
  // Handle URL params (login, verification, errors)
  useEffect(() => {
    // Auto-open login dialog if ?login=true in URL
    if (searchParams?.get('login') === 'true') {
      openLoginModal?.('login')
      window.history.replaceState({}, '', '/')
    }
      
    // Show verification success toast
    if (searchParams?.get('verified') === 'success') {
      toast.success(language === 'ru' ? 'Email подтверждён! Вы вошли в систему.' : 'Email verified! You are now logged in.')
      window.history.replaceState({}, '', '/')
      // Reload user from cookie
      fetch('/api/v2/auth/me', { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          if (data.success && data.user) {
            setCurrentUser(data.user)
            localStorage.setItem('gostaylo_user', JSON.stringify(data.user))
          }
        })
    }
    
    // Show auth error
    const authError = searchParams?.get('auth_error')
    if (authError) {
      const errorMessages = {
        'missing_token': 'Отсутствует токен верификации',
        'invalid_or_expired_token': 'Ссылка устарела или недействительна',
        'invalid_token_type': 'Неверный тип токена',
        'verification_failed': 'Ошибка верификации',
        'user_not_found': 'Пользователь не найден'
      }
      toast.error(errorMessages[authError] || 'Ошибка авторизации')
      window.history.replaceState({}, '', '/')
    }
  }, [searchParams, language, openLoginModal])

  useEffect(() => {
    const detected = detectLanguage()
    setLanguageState(detected)
  }, [])

  // Listen for currency changes from UniversalHeader
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    // Load initial currency
    const savedCurrency = localStorage.getItem('gostaylo_currency')
    if (savedCurrency) setCurrency(savedCurrency)

    // Listen for changes from CurrencySelector in header
    const handleCurrencyChange = (e) => {
      setCurrency(e.detail)
    }
    window.addEventListener('currency-change', handleCurrencyChange)
    return () => window.removeEventListener('currency-change', handleCurrencyChange)
  }, [])

  const handleLanguageChange = (lang) => {
    setLanguageState(lang)
    saveLanguage(lang)
  }

  // Handle logout  
  function handleLogout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('gostaylo_user')
    }
    setCurrentUser(null)
    router.push('/')
  }

  // Load data
  useEffect(() => {
    async function loadData() {
      try {
        const [cats, items, rates, dists] = await Promise.all([
          fetchCategories(),
          fetchListings(),
          fetchExchangeRates(),
          fetchDistricts()
        ])
        setCategories(cats)
        setListings(items)
        setExchangeRates(rates)
        setDistricts(dists)
      } catch (error) {
        console.error('Failed to load data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Price conversion
  function convertPrice(priceThb) {
    if (!priceThb) return 0
    if (currency === 'THB') return priceThb
    const rate = exchangeRates[currency]
    return rate ? priceThb / rate : priceThb
  }

  const categoryIcons = {
    property: Home,
    vehicles: Bike,
    tours: Map,
    yachts: Anchor,
  }

  // Filter listings
  const filteredListings = listings.filter(listing => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesSearch = 
        listing.title?.toLowerCase().includes(query) ||
        listing.description?.toLowerCase().includes(query) ||
        listing.district?.toLowerCase().includes(query)
      if (!matchesSearch) return false
    }
    // Category filter
    if (selectedCategory !== 'all') {
      const cat = categories.find(c => c.slug === selectedCategory)
      if (cat && listing.category_id !== cat.id) return false
    }
    // District filter
    if (selectedDistrict !== 'all' && listing.district !== selectedDistrict) {
      return false
    }
    return true
  })

  /**
   * URL Bridge Search Handler
   * Navigates to /listings with all search params in URL
   * This allows other components to consume search state
   */
  const handleSearch = useCallback(() => {
    // Build URL query params
    const params = new URLSearchParams()
    
    // Add search query
    if (searchQuery.trim()) {
      params.set('q', searchQuery.trim())
    }
    
    // Add location/district
    if (selectedDistrict && selectedDistrict !== 'all') {
      params.set('location', selectedDistrict)
    }
    
    // Add category
    if (selectedCategory && selectedCategory !== 'all') {
      params.set('category', selectedCategory)
    }
    
    // Add dates (YYYY-MM-DD format for API compatibility)
    if (dateRange.from) {
      params.set('checkIn', format(dateRange.from, 'yyyy-MM-dd'))
    }
    if (dateRange.to && !isSameDay(dateRange.from, dateRange.to)) {
      params.set('checkOut', format(dateRange.to, 'yyyy-MM-dd'))
    }
    
    // Add guests
    if (guests && guests !== '1') {
      params.set('guests', guests)
    }
    
    // Navigate to listings page with params
    const queryString = params.toString()
    const url = queryString ? `/listings?${queryString}` : '/listings'
    
    console.log('[SEARCH] Navigating to:', url)
    router.push(url)
  }, [searchQuery, selectedDistrict, selectedCategory, dateRange, guests, router])

  return (
    <div className='min-h-screen bg-white'>
      {/* Hero Section - pt-14 accounts for fixed header */}
      <section className='relative pt-14 min-h-[550px] sm:min-h-[600px] bg-cover bg-center' style={{ backgroundImage: 'url(https://images.pexels.com/photos/33607600/pexels-photo-33607600.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940)' }}>
        <div className='absolute inset-0 bg-gradient-to-r from-slate-900/80 to-slate-900/40' />
        <div className='relative container mx-auto px-4 min-h-[480px] sm:min-h-[530px] flex flex-col justify-center'>
          <div className='max-w-3xl mx-auto sm:mx-0'>
            <h1 className='text-3xl sm:text-5xl md:text-6xl font-bold text-white mb-4 text-center sm:text-left'>
              {getUIText('heroTitle', language)}
              <span className='block text-teal-400'>{getUIText('heroTitleHighlight', language)}</span>
            </h1>
            <p className='text-base sm:text-xl text-slate-200 mb-6 sm:mb-8 text-center sm:text-left'>
              {getUIText('heroSubtitle', language)}
            </p>

            {/* Search Bar - URL Bridge */}
            <Card className='bg-white shadow-2xl w-full'>
              <CardContent className='p-4 sm:p-6'>
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3'>
                  {/* Search Input */}
                  <div className='sm:col-span-2'>
                    <div className='relative'>
                      <Search className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4' />
                      <Input
                        placeholder={getUIText('searchPlaceholder', language)}
                        className='pl-10 h-10'
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        data-testid="search-input"
                      />
                    </div>
                  </div>
                  
                  {/* Date Range Picker */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="h-10 w-full justify-start text-left font-normal"
                        data-testid="search-date-picker"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
                        {dateRange.from ? (
                          dateRange.to && !isSameDay(dateRange.from, dateRange.to) ? (
                            <span className="text-sm">
                              {format(dateRange.from, 'd MMM', { locale: language === 'ru' ? ru : enUS })} — {format(dateRange.to, 'd MMM', { locale: language === 'ru' ? ru : enUS })}
                            </span>
                          ) : (
                            <span className="text-sm">{format(dateRange.from, 'd MMM', { locale: language === 'ru' ? ru : enUS })} — ...</span>
                          )
                        ) : (
                          <span className="text-muted-foreground text-sm">{getUIText('selectDates', language)}</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-4" align="start">
                      <DayPicker
                        mode="range"
                        selected={dateRange}
                        onSelect={setDateRange}
                        locale={language === 'ru' ? ru : enUS}
                        numberOfMonths={1}
                        disabled={{ before: new Date() }}
                        className="rounded-md"
                      />
                    </PopoverContent>
                  </Popover>
                  
                  {/* District/Location */}
                  <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
                    <SelectTrigger className='h-10' data-testid="search-district">
                      <MapPin className="h-4 w-4 mr-2 text-slate-400" />
                      <SelectValue placeholder={getUIText('district', language)} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='all'>{getUIText('allDistricts', language)}</SelectItem>
                      {districts.map(district => (
                        <SelectItem key={district} value={district}>{district}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {/* Guests */}
                  <Select value={guests} onValueChange={setGuests}>
                    <SelectTrigger className='h-10' data-testid="search-guests">
                      <Users className="h-4 w-4 mr-2 text-slate-400" />
                      <SelectValue placeholder={language === 'ru' ? 'Гости' : 'Guests'} />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map(num => (
                        <SelectItem key={num} value={String(num)}>
                          {num} {language === 'ru' ? (num === 1 ? 'гость' : num < 5 ? 'гостя' : 'гостей') : (num === 1 ? 'guest' : 'guests')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Search Button */}
                  <Button 
                    onClick={handleSearch}
                    className='h-10 bg-teal-600 hover:bg-teal-700'
                    data-testid="search-button"
                  >
                    <Search className='h-4 w-4 mr-2' />
                    {language === 'ru' ? 'Найти' : 'Search'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className='py-12 sm:py-16 bg-white'>
        <div className='container mx-auto px-4'>
          <div className='text-center mb-10'>
            <h2 className='text-2xl sm:text-3xl font-bold text-slate-900 mb-3'>{getUIText('categories', language)}</h2>
            <p className='text-slate-600'>
              {language === 'ru' ? 'Выберите то, что вам нужно' : 'Choose what you need'}
            </p>
          </div>

          <div className='grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6'>
            {categories.map((cat, idx) => {
              const Icon = categoryIcons[cat.slug] || Home
              const images = [
                'https://images.pexels.com/photos/33607600/pexels-photo-33607600.jpeg',
                'https://images.pexels.com/photos/31342032/pexels-photo-31342032.jpeg',
                'https://images.pexels.com/photos/18277777/pexels-photo-18277777.jpeg',
                'https://images.unsplash.com/photo-1566735201951-bc1cbeeb2964',
              ]
              
              return (
                <Card
                  key={cat.id}
                  className='group cursor-pointer overflow-hidden hover:shadow-lg transition-all duration-300 border hover:border-teal-500'
                  onClick={() => router.push(`/listings?category=${cat.slug}`)}
                >
                  <div className='relative h-32 sm:h-48 overflow-hidden'>
                    <img
                      src={images[idx]}
                      alt={cat.name}
                      className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-300'
                    />
                    <div className='absolute inset-0 bg-gradient-to-t from-slate-900/70 to-transparent' />
                    <div className='absolute bottom-3 left-3 right-3'>
                      <div className='flex items-center gap-2 text-white'>
                        <Icon className='h-5 w-5' />
                        <h3 className='text-base sm:text-lg font-bold'>{getCategoryName(cat.slug, language, cat.name)}</h3>
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
      <section id='listings-section' className='py-12 sm:py-16 bg-slate-50'>
        <div className='container mx-auto px-4'>
          <div className='flex items-center justify-between mb-8'>
            <div>
              <h2 className='text-2xl sm:text-3xl font-bold text-slate-900 mb-1'>{getUIText('currentListings', language)}</h2>
              <p className='text-slate-600 text-sm'>{getUIText('found', language)}: {filteredListings.length} {getUIText('objects', language)}</p>
            </div>
          </div>

          {loading ? (
            <div className='text-center py-12'>
              <Loader2 className='h-10 w-10 animate-spin text-teal-600 mx-auto' />
              <p className='mt-4 text-slate-600'>{getUIText('loading', language)}...</p>
            </div>
          ) : filteredListings.length === 0 ? (
            <div className='text-center py-12'>
              <p className='text-slate-600'>{language === 'ru' ? 'Ничего не найдено' : 'No results found'}</p>
            </div>
          ) : (
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5'>
              {filteredListings.map(listing => (
                <Link key={listing.id} href={`/listings/${listing.id}`}>
                  <Card className='group h-full flex flex-col overflow-hidden hover:shadow-lg transition-all duration-300 border hover:border-teal-400 bg-white'>
                    {/* Image */}
                    <div className='relative h-44 sm:h-48 overflow-hidden flex-shrink-0'>
                      <img
                        src={listing.images?.[0] || '/placeholder.jpg'}
                        alt={listing.title}
                        className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-300'
                      />
                      {listing.isFeatured && (
                        <div className='absolute top-2 left-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-2 py-0.5 rounded-full text-xs font-bold shadow'>
                          ⭐ {getUIText('featured', language)}
                        </div>
                      )}
                      {listing.rating > 0 && (
                        <div className='absolute top-2 right-2 bg-teal-600 text-white px-2 py-0.5 rounded-full text-xs font-semibold shadow'>
                          ⭐ {listing.rating}
                        </div>
                      )}
                    </div>
                    
                    {/* Content - flex-grow to push footer down */}
                    <div className='flex flex-col flex-grow p-4'>
                      <h3 className='font-semibold text-slate-900 line-clamp-1 text-base mb-1'>
                        {getListingText(listing, 'title', language)}
                      </h3>
                      <p className='text-slate-500 text-sm line-clamp-2 mb-3 flex-grow'>
                        {getListingText(listing, 'description', language)}
                      </p>
                      
                      {/* Location */}
                      <div className='flex items-center gap-1.5 text-sm text-slate-600 mb-2'>
                        <MapPin className='h-3.5 w-3.5' />
                        <span>{listing.district}</span>
                      </div>
                      
                      {/* Icons row - aligned */}
                      {(listing.bedrooms || listing.bathrooms || listing.area) && (
                        <div className='flex items-center gap-4 text-xs text-slate-500 mb-3'>
                          {listing.bedrooms > 0 && (
                            <span className='flex items-center gap-1'>
                              <BedDouble className='h-3.5 w-3.5' />
                              {listing.bedrooms}
                            </span>
                          )}
                          {listing.bathrooms > 0 && (
                            <span className='flex items-center gap-1'>
                              <Bath className='h-3.5 w-3.5' />
                              {listing.bathrooms}
                            </span>
                          )}
                          {listing.area > 0 && (
                            <span className='flex items-center gap-1'>
                              <Maximize className='h-3.5 w-3.5' />
                              {listing.area}м²
                            </span>
                          )}
                        </div>
                      )}
                      
                      {/* Price */}
                      <div className='flex items-baseline justify-between mb-3'>
                        <span className='text-xl font-bold text-teal-600'>
                          {formatPrice(convertPrice(listing.currentPrice || listing.basePriceThb), currency)}
                        </span>
                        <span className='text-xs text-slate-500'>/{getUIText('pricePerDay', language)}</span>
                      </div>
                    </div>
                    
                    {/* Footer - mt-auto pushes to bottom */}
                    <div className='px-4 pb-4 mt-auto'>
                      <Button className='w-full bg-teal-600 hover:bg-teal-700 h-9 text-sm'>
                        {getUIText('bookNow', language)}
                      </Button>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className='bg-slate-900 text-white py-10 sm:py-12'>
        <div className='container mx-auto px-4'>
          <div className='grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8'>
            <div className='col-span-2 md:col-span-1'>
              <div className='flex flex-col leading-none mb-4'>
                <span className='text-xl font-black text-white tracking-tight'>Go</span>
                <span className='text-xl font-black text-teal-400 tracking-tight ml-4 -mt-1'>staylo</span>
              </div>
              <p className='text-slate-400 text-sm'>{getUIText('footerDesc', language)}</p>
            </div>
            
            <div>
              <h4 className='font-semibold mb-3 text-sm'>{getUIText('footerCategories', language)}</h4>
              <ul className='space-y-2 text-sm text-slate-400'>
                <li>{getCategoryName('property', language)}</li>
                <li>{getCategoryName('vehicles', language)}</li>
                <li>{getCategoryName('tours', language)}</li>
                <li>{getCategoryName('yachts', language)}</li>
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
                <li>{getUIText('privacyPolicy', language)}</li>
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
