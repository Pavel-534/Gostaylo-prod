'use client'

/**
 * GostayloHomeContent - Home Page with Unified Calendar
 * 
 * REFACTORED: Removed react-day-picker, using SearchCalendar component
 * 
 * @updated 2026-03-13
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import {
  MapPin,
  Home,
  Bike,
  Map,
  Anchor,
  Loader2,
  BedDouble,
  Bath,
  Users,
  Ship,
  Clock,
  Route,
  Car,
} from 'lucide-react'
import { UnifiedSearchBar } from '@/components/search/UnifiedSearchBar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatPrice } from '@/lib/currency'
import { fetchCategories, fetchExchangeRates } from '@/lib/client-data'
import {
  detectLanguage,
  setLanguage as persistLanguage,
  getCategoryName,
  getUIText,
  getListingText,
} from '@/lib/translations'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'
import { ListingGridSkeleton } from '@/components/listing-card-skeleton'
import { proxifyUnsplashUrl } from '@/lib/proxify-unsplash-url'
import { format, isSameDay, differenceInDays } from 'date-fns'
import { LISTINGS_SEARCH_API_PATH } from '@/lib/search-endpoints'
import { getListingRentalPeriodMode } from '@/lib/listing-booking-ui'
import {
  isTransportListingCategory,
  isTourListingCategory,
  isYachtLikeCategory,
  showsPropertyInteriorSpecs,
} from '@/lib/listing-category-slug'
import { resolveListingGuestCapacity } from '@/lib/listing-guest-capacity'
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

// Media query hook
/** Внешние фото главной: не из Supabase. next/image с оптимизацией тянет CDN с сервера Node — при таймаутах даёт 500; для внешних URL используем unoptimized (грузит браузер). */
const HERO_BACKGROUND_IMAGE = proxifyUnsplashUrl(
  'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1920&q=80'
)
const CATEGORY_CARD_IMAGES = [
  proxifyUnsplashUrl('https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=80'),
  proxifyUnsplashUrl('https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=1200&q=80'),
  proxifyUnsplashUrl('https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80'),
  proxifyUnsplashUrl('https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?auto=format&fit=crop&w=1200&q=80'),
]

function isAbsoluteHttpUrl(src) {
  return typeof src === 'string' && (src.startsWith('http://') || src.startsWith('https://'))
}

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
  const [exchangeRates, setExchangeRates] = useState({})
  const [loading, setLoading] = useState(true)
  const [listingsLoading, setListingsLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  
  // Search filters (What | Where | When | Who) - 4 fields only
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [where, setWhere] = useState('all')
  const [dateRange, setDateRange] = useState({ from: null, to: null })
  const [guests, setGuests] = useState('2')
  const [searchQuery, setSearchQuery] = useState('')
  const [smartSearchOn, setSmartSearchOn] = useState(true)
  const [semanticSiteEnabled, setSemanticSiteEnabled] = useState(true)
  const pendingHomeSemanticRef = useRef(false)
  const [aiGridPending, setAiGridPending] = useState(false)

  // Live counter
  const [liveCount, setLiveCount] = useState(null)
  const [countLoading, setCountLoading] = useState(false)

  /** Внешние URL (Unsplash / Supabase) не загрузились — показываем локальный placeholder */
  const [mediaFallback, setMediaFallback] = useState({})
  const markMediaFailed = useCallback((key) => {
    setMediaFallback((m) => (m[key] ? m : { ...m, [key]: true }))
  }, [])
  
  // Debounced values
  const debouncedDateRange = useDebounce(dateRange, 500)
  const debouncedWhere = useDebounce(where, 300)
  const debouncedGuests = useDebounce(guests, 300)
  const debouncedSearchQuery = useDebounce(searchQuery, 400)

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
  
  // Initialize search from URL (e.g. back navigation, shared link)
  useEffect(() => {
    const cat = searchParams?.get('category')
    const w = searchParams?.get('where') || searchParams?.get('location') || searchParams?.get('city')
    const g = searchParams?.get('guests')
    const ci = searchParams?.get('checkIn')
    const co = searchParams?.get('checkOut')
    const qUrl = searchParams?.get('q')
    const sem = searchParams?.get('semantic')
    if (cat) setSelectedCategory(cat)
    if (w) setWhere(w)
    if (g) setGuests(g)
    if (qUrl) setSearchQuery(qUrl)
    if (sem === '0') setSmartSearchOn(false)
    else if (sem === '1') setSmartSearchOn(true)
    else {
      try {
        const ls = localStorage.getItem('gostaylo_smart_search')
        if (ls === '0') setSmartSearchOn(false)
        else if (ls === '1') setSmartSearchOn(true)
      } catch {
        /* ignore */
      }
    }
    if (ci && co) {
      try {
        setDateRange({ from: new Date(ci), to: new Date(co) })
      } catch {}
    }
  }, [])

  useEffect(() => {
    fetch('/api/v2/site-features')
      .then((r) => r.json())
      .then((j) => {
        if (j.success && j.data && typeof j.data.semanticSearchOnSite === 'boolean') {
          setSemanticSiteEnabled(j.data.semanticSearchOnSite)
        }
      })
      .catch(() => {})
  }, [])

  // Handle URL params (login, verification)
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
    const initial = detectLanguage()
    setLanguageState(initial)
    persistLanguage(initial)
    document.documentElement.lang = initial

    const handleLang = (e) => {
      const next = e?.detail
      if (!next) return
      setLanguageState(next)
      persistLanguage(next)
      document.documentElement.lang = next
    }

    window.addEventListener('language-change', handleLang)
    window.addEventListener('languageChange', handleLang) // legacy
    return () => {
      window.removeEventListener('language-change', handleLang)
      window.removeEventListener('languageChange', handleLang)
    }
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

  // Initial data load (locations come from UnifiedSearchBar via /api/v2/search/locations)
  useEffect(() => {
    Promise.all([fetchCategories(), fetchExchangeRates()])
      .then(([cats, rates]) => {
        setCategories(cats)
        setExchangeRates(rates)
      })
      .catch(console.error)
  }, [])

  // Fetch listings from API
  const fetchListingsData = useCallback(async (showLoading = true) => {
    if (showLoading) setListingsLoading(true)
    
    try {
      const params = new URLSearchParams({ limit: '12', featured: 'true' })
      if (selectedCategory && selectedCategory !== 'all') params.set('category', selectedCategory)
      if (where && where !== 'all') params.set('where', where)
      if (dateRange.from && dateRange.to && !isSameDay(dateRange.from, dateRange.to)) {
        params.set('checkIn', format(dateRange.from, 'yyyy-MM-dd'))
        params.set('checkOut', format(dateRange.to, 'yyyy-MM-dd'))
      }
      if (guests && guests !== '1') params.set('guests', guests)
      const useSem =
        pendingHomeSemanticRef.current && semanticSiteEnabled && smartSearchOn
      const qt = (useSem ? searchQuery : debouncedSearchQuery).trim()
      if (pendingHomeSemanticRef.current) pendingHomeSemanticRef.current = false
      if (qt.length >= 2) {
        params.set('q', qt)
        if (useSem) params.set('semantic', '1')
      }

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
  }, [selectedCategory, where, dateRange, guests, debouncedSearchQuery, searchQuery, semanticSiteEnabled, smartSearchOn])

  // Initial load
  useEffect(() => {
    fetchListingsData()
  }, [fetchListingsData])

  // Live updates
  useEffect(() => {
    if (!loading) fetchListingsData(false)
  }, [debouncedDateRange, debouncedWhere, debouncedGuests, debouncedSearchQuery, loading, fetchListingsData])

  // Live count fetch for search bar
  const fetchLiveCount = useCallback(async (dr, w, g, cat) => {
    setCountLoading(true)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (cat && cat !== 'all') params.set('category', cat)
      if (w && w !== 'all') params.set('where', w)
      if (dr?.from && dr?.to && !isSameDay(dr.from, dr.to)) {
        params.set('checkIn', format(dr.from, 'yyyy-MM-dd'))
        params.set('checkOut', format(dr.to, 'yyyy-MM-dd'))
      }
      if (g && g !== '1') params.set('guests', g)
      const qt = (searchQuery || '').trim()
      if (qt.length >= 2) params.set('q', qt)

      const response = await fetch(`${LISTINGS_SEARCH_API_PATH}?${params.toString()}`)
      const data = await response.json()
      if (data.success) setLiveCount(data.data.meta.available)
    } catch (e) {
      console.error('Live count error:', e)
    } finally {
      setCountLoading(false)
    }
  }, [searchQuery])


  const categoryIcons = { property: Home, vehicles: Bike, tours: Map, yachts: Anchor }

  // URL Bridge Search - 4 params: What, Where, When, Who
  const handleSearch = useCallback(() => {
    const params = new URLSearchParams()
    if (selectedCategory && selectedCategory !== 'all') params.set('category', selectedCategory)
    if (where && where !== 'all') params.set('where', where)
    if (dateRange.from) params.set('checkIn', format(dateRange.from, 'yyyy-MM-dd'))
    if (dateRange.to && !isSameDay(dateRange.from, dateRange.to)) params.set('checkOut', format(dateRange.to, 'yyyy-MM-dd'))
    if (guests && guests !== '1') params.set('guests', guests)
    const qt = searchQuery.trim()
    if (qt.length >= 2) params.set('q', qt)
    if (semanticSiteEnabled) params.set('semantic', smartSearchOn ? '1' : '0')
    router.push(params.toString() ? `/listings?${params.toString()}` : '/listings')
  }, [selectedCategory, where, dateRange, guests, searchQuery, semanticSiteEnabled, smartSearchOn, router])

  const handleHomeSearchSubmit = useCallback(() => {
    if (smartSearchOn && semanticSiteEnabled && searchQuery.trim().length >= 2) {
      setAiGridPending(true)
    }
    pendingHomeSemanticRef.current = true
    fetchListingsData(false)
  }, [smartSearchOn, semanticSiteEnabled, searchQuery, fetchListingsData])

  useEffect(() => {
    if (!listingsLoading) setAiGridPending(false)
  }, [listingsLoading])

  const handleQuickCategorySearch = useCallback(
    (slug) => {
      setSelectedCategory(slug)
      const params = new URLSearchParams()
      params.set('category', slug)
      if (where && where !== 'all') params.set('where', where)
      if (dateRange.from) params.set('checkIn', format(dateRange.from, 'yyyy-MM-dd'))
      if (dateRange.to && !isSameDay(dateRange.from, dateRange.to)) {
        params.set('checkOut', format(dateRange.to, 'yyyy-MM-dd'))
      }
      if (guests && guests !== '1') params.set('guests', guests)
      const qt = searchQuery.trim()
      if (qt.length >= 2) params.set('q', qt)
      if (semanticSiteEnabled) params.set('semantic', smartSearchOn ? '1' : '0')
      router.push(`/listings?${params.toString()}`)
    },
    [where, dateRange, guests, searchQuery, semanticSiteEnabled, smartSearchOn, router]
  )

  const nights = dateRange.from && dateRange.to ? differenceInDays(dateRange.to, dateRange.from) : 0
  const locale = language === 'ru' ? ru : enUS

  // Handle calendar date change with live count update
  const handleDateChange = useCallback((newRange) => {
    setDateRange(newRange)
    if (newRange.from && newRange.to) {
      fetchLiveCount(newRange, where, guests, selectedCategory)
    }
  }, [where, guests, selectedCategory, fetchLiveCount])

  useEffect(() => {
    if (dateRange.from && dateRange.to) {
      fetchLiveCount(dateRange, where, guests, selectedCategory)
    }
  }, [debouncedSearchQuery, dateRange, where, guests, selectedCategory, fetchLiveCount])

  return (
    <div className='min-h-screen bg-white'>
      {/* Hero Section */}
      <section className='relative pt-14 min-h-[500px] sm:min-h-[580px] bg-slate-900 bg-cover bg-center' style={{ backgroundImage: `url(${HERO_BACKGROUND_IMAGE})` }}>
        <div className='absolute inset-0 bg-gradient-to-r from-slate-900/80 to-slate-900/40' />
        <div className='relative container mx-auto min-h-[440px] min-w-0 max-w-full px-3 sm:min-h-[510px] sm:px-4 flex flex-col justify-center'>
          <div className='mx-auto w-full min-w-0 max-w-3xl sm:mx-0'>
            <h1 className='text-3xl sm:text-5xl md:text-6xl font-bold text-white mb-4 text-center sm:text-left'>
              {getUIText('heroTitle', language)}
              <span className='block text-teal-400'>{getUIText('heroTitleHighlight', language)}</span>
            </h1>
            <p className='text-base sm:text-xl text-slate-200 mb-6 sm:mb-8 text-center sm:text-left'>
              {getUIText('heroSubtitle', language)}
            </p>

            {/* Unified Search Bar (What | Where | When | Who) */}
            <UnifiedSearchBar
              variant="hero"
              language={language}
              category={selectedCategory}
              setCategory={setSelectedCategory}
              where={where}
              setWhere={setWhere}
              dateRange={dateRange}
              setDateRange={handleDateChange}
              guests={guests}
              setGuests={setGuests}
              onSearch={handleSearch}
              onQuickCategorySearch={handleQuickCategorySearch}
              textQuery={searchQuery}
              setTextQuery={setSearchQuery}
              smartSearchOn={smartSearchOn}
              setSmartSearchOn={setSmartSearchOn}
              semanticSearchFeatureEnabled={semanticSiteEnabled}
              onSearchSubmit={handleHomeSearchSubmit}
              liveCount={liveCount}
              countLoading={countLoading}
              nights={nights}
            />
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className='py-10 sm:py-14 bg-white'>
        <div className='container mx-auto px-4'>
          <h2 className='text-xl sm:text-2xl font-bold text-slate-900 mb-6 text-center sm:text-left'>{getUIText('categories', language)}</h2>
          <div className='grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4'>
            {categories.map((cat, idx) => {
              const Icon = categoryIcons[cat.slug] || Home
              const cardImage = CATEGORY_CARD_IMAGES[idx % CATEGORY_CARD_IMAGES.length]
              return (
                <Card key={cat.id} className='group cursor-pointer overflow-hidden hover:shadow-lg transition-all border hover:border-teal-500' onClick={() => {
                  setSelectedCategory(cat.slug)
                  const params = new URLSearchParams()
                  params.set('category', cat.slug)
                  if (where !== 'all') params.set('where', where)
                  if (dateRange.from) params.set('checkIn', format(dateRange.from, 'yyyy-MM-dd'))
                  if (dateRange.to && !isSameDay(dateRange.from, dateRange.to)) params.set('checkOut', format(dateRange.to, 'yyyy-MM-dd'))
                  if (guests !== '1') params.set('guests', guests)
                  const qt = searchQuery.trim()
                  if (qt.length >= 2) params.set('q', qt)
                  if (semanticSiteEnabled) params.set('semantic', smartSearchOn ? '1' : '0')
                  router.push(`/listings?${params.toString()}`)
                }}>
                  <div className='relative h-28 sm:h-40 overflow-hidden'>
                    <Image
                      src={mediaFallback[`cat-${cat.id}`] ? '/placeholder.svg' : cardImage}
                      alt={cat.name}
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 25vw"
                      priority={idx < 4}
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={() => markMediaFailed(`cat-${cat.id}`)}
                    />
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

          {aiGridPending && listingsLoading ? (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50/90 px-4 py-3 text-sm font-medium text-violet-900 shadow-sm">
              <span aria-hidden className="text-base">
                ✨
              </span>
              {getUIText('aiSearchLoadingBanner', language)}
            </div>
          ) : null}

          {/* Skeleton Loading */}
          {loading ? (
            <ListingGridSkeleton count={8} />
          ) : listings.length === 0 ? (
            <div className='text-center py-12'><p className='text-slate-600'>{language === 'ru' ? 'Ничего не найдено' : 'No results'}</p></div>
          ) : (
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
              {listings.map((listing, idx) => {
                const listingParams = new URLSearchParams()
                if (dateRange.from) listingParams.set('checkIn', format(dateRange.from, 'yyyy-MM-dd'))
                if (dateRange.to && !isSameDay(dateRange.from, dateRange.to)) listingParams.set('checkOut', format(dateRange.to, 'yyyy-MM-dd'))
                if (guests !== '1') listingParams.set('guests', guests)
                const listingUrl = listingParams.toString() ? `/listings/${listing.id}?${listingParams.toString()}` : `/listings/${listing.id}`
                const thumbRaw = listing.coverImage || listing.images?.[0] || '/placeholder.svg'
                const thumbSrc =
                  thumbRaw === '/placeholder.svg' ? thumbRaw : proxifyUnsplashUrl(thumbRaw)
                
                return (
                  <Link key={listing.id} href={listingUrl}>
                    <Card className='group h-full flex flex-col overflow-hidden hover:shadow-lg transition-all border hover:border-teal-400 bg-white'>
                      <div className='relative h-40 sm:h-44 overflow-hidden flex-shrink-0'>
                        <Image
                          src={mediaFallback[`lst-${listing.id}`] ? '/placeholder.svg' : thumbSrc}
                          alt={listing.title}
                          fill
                          unoptimized={isAbsoluteHttpUrl(thumbSrc)}
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                          priority={idx < 4}
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={() => markMediaFailed(`lst-${listing.id}`)}
                        />
                        {listing.isFeatured && <Badge className='absolute top-2 left-2 bg-gradient-to-r from-purple-600 to-pink-600'>⭐ TOP</Badge>}
                        {listing.rating > 0 && <Badge className='absolute top-2 right-2 bg-teal-600'>⭐ {listing.rating}</Badge>}
                      </div>
                      <div className='flex flex-col flex-grow p-3'>
                        <h3 className='font-semibold text-slate-900 line-clamp-1 text-sm mb-1'>{getListingText(listing, 'title', language)}</h3>
                        <div className='flex items-center gap-1 text-xs text-slate-500 mb-2'>
                          <MapPin className='h-3 w-3' /><span>{listing.district}</span>
                        </div>
                        {(() => {
                          const slug =
                            listing.categorySlug || listing.category?.slug || listing.metadata?.category_slug || ''
                          const propertyInterior = showsPropertyInteriorSpecs(slug)
                          const yachtCard = isYachtLikeCategory(slug)
                          const tourCard = isTourListingCategory(slug)
                          const vehicleCard = isTransportListingCategory(slug)
                          const meta = listing.metadata || {}
                          const cabins =
                            parseInt(String(meta.cabins ?? meta.cabins_count ?? '').replace(/\D/g, ''), 10) || 0
                          const durationHours =
                            parseInt(String(meta.duration_hours ?? meta.tour_hours ?? '').replace(/\D/g, ''), 10) ||
                            0
                          const engineCc =
                            parseInt(String(meta.engine_cc ?? '').replace(/\D/g, ''), 10) || 0
                          const cap = resolveListingGuestCapacity(listing)
                          const showSpecs =
                            (propertyInterior && (listing.bedrooms > 0 || listing.bathrooms > 0)) ||
                            yachtCard ||
                            tourCard ||
                            vehicleCard ||
                            cap > 0
                          if (!showSpecs) return null
                          return (
                            <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mb-2'>
                              {propertyInterior && listing.bedrooms > 0 && (
                                <span className='flex items-center gap-0.5'>
                                  <BedDouble className='h-3 w-3 shrink-0' aria-hidden />
                                  {listing.bedrooms}
                                </span>
                              )}
                              {propertyInterior && listing.bathrooms > 0 && (
                                <span className='flex items-center gap-0.5'>
                                  <Bath className='h-3 w-3 shrink-0' aria-hidden />
                                  {listing.bathrooms}
                                </span>
                              )}
                              {yachtCard && (
                                <span className='flex items-center gap-0.5' title={getCategoryName('yachts', language)}>
                                  <Anchor className='h-3 w-3 shrink-0' aria-hidden />
                                </span>
                              )}
                              {yachtCard && cabins > 0 && (
                                <span className='flex items-center gap-0.5'>
                                  <Ship className='h-3 w-3 shrink-0' aria-hidden />
                                  {cabins}
                                </span>
                              )}
                              {tourCard && (
                                <span className='flex items-center gap-0.5' title={getCategoryName('tours', language)}>
                                  <Route className='h-3 w-3 shrink-0' aria-hidden />
                                </span>
                              )}
                              {tourCard && durationHours > 0 && (
                                <span className='flex items-center gap-0.5'>
                                  <Clock className='h-3 w-3 shrink-0' aria-hidden />
                                  {durationHours}h
                                </span>
                              )}
                              {vehicleCard && !yachtCard && (
                                <span className='flex items-center gap-0.5' title={getCategoryName('vehicles', language)}>
                                  <Car className='h-3 w-3 shrink-0' aria-hidden />
                                </span>
                              )}
                              {vehicleCard && !yachtCard && engineCc > 0 && (
                                <span className='tabular-nums font-medium text-slate-500'>{engineCc}cc</span>
                              )}
                              <span className='flex items-center gap-0.5'>
                                <Users className='h-3 w-3 shrink-0' aria-hidden />
                                {cap}
                              </span>
                            </div>
                          )
                        })()}
                        <div className='mt-auto flex items-baseline justify-between'>
                          <span className='text-lg font-bold text-teal-600'>
                            {formatPrice(
                              listing.pricing?.totalPrice || listing.basePriceThb,
                              currency,
                              exchangeRates,
                            )}
                          </span>
                          <span className='text-xs text-slate-400'>
                            /
                            {listing.pricing
                              ? `${nights}${language === 'ru' ? 'н.' : 'n'}`
                              : getListingRentalPeriodMode(
                                  listing.categorySlug || listing.category?.slug || '',
                                ) === 'day'
                                ? getUIText('listingPriceUnitDay', language)
                                : getUIText('night', language)}
                          </span>
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
            <p>© 2025 GoStayLo. {getUIText('allRightsReserved', language)}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
