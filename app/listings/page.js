'use client'

/**
 * Gostaylo - Search Results Page
 * Clean Component-Based Architecture (Phase 7.4)
 * 
 * Components:
 * - FilterBar: Search inputs and active filters display
 * - ListingSidebar: Grid view with infinite scroll
 * - SearchMapWrapper: Interactive Leaflet map
 * 
 * @refactored Phase 7.4 - Under 200 lines target
 */

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { format, parseISO, differenceInDays } from 'date-fns'
import { fetchExchangeRates } from '@/lib/client-data'
import { FilterBar } from '@/components/search/FilterBar'
import { ListingSidebar } from '@/components/search/ListingSidebar'
import { SearchMapWrapper } from '@/components/search/SearchMapWrapper'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'
import { useDebounce, useIntersectionObserver, useListingsFetch } from '@/lib/hooks/useListingsSearch'
import { detectLanguage } from '@/lib/translations'

const ITEMS_PER_PAGE = 12

function ListingsContent() {
  const searchParams = useSearchParams()
  const { user } = useAuth()
  
  // Initialize from URL
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'all')
  const [selectedDistrict, setSelectedDistrict] = useState(searchParams.get('location') || 'all')
  const [guests, setGuests] = useState(searchParams.get('guests') || '2')
  const [dateRange, setDateRange] = useState({
    from: searchParams.get('checkIn') ? parseISO(searchParams.get('checkIn')) : null,
    to: searchParams.get('checkOut') ? parseISO(searchParams.get('checkOut')) : null
  })
  
  // UI state
  const [language, setLanguage] = useState('en')
  const [currency, setCurrency] = useState('THB')
  const [exchangeRates, setExchangeRates] = useState({ THB: 1, USD: 35.5, RUB: 0.37 })
  const [showMap, setShowMap] = useState(false)
  const [userFavorites, setUserFavorites] = useState(new Set())
  const [userBookings, setUserBookings] = useState([])
  
  // Debounced values
  const debouncedQuery = useDebounce(searchQuery)
  const debouncedDistrict = useDebounce(selectedDistrict)
  const debouncedGuests = useDebounce(guests)
  const debouncedDateRange = useDebounce(dateRange)
  
  // Fetch listings with custom hook
  const {
    listings,
    allListings,
    displayedCount,
    loading,
    loadingMore,
    meta,
    error,
    isTransitioning,
    fetchListings,
    loadMore,
    retry
  } = useListingsFetch({
    debouncedQuery,
    selectedCategory,
    debouncedDistrict,
    debouncedDateRange,
    debouncedGuests,
    itemsPerPage: ITEMS_PER_PAGE
  })
  
  const loadMoreRef = useIntersectionObserver(loadMore)
  
  // Initialize language, currency, favorites
  useEffect(() => {
    setLanguage(detectLanguage())
    
    const storedCurrency = localStorage.getItem('gostaylo_currency')
    if (storedCurrency) setCurrency(storedCurrency)
    
    fetchExchangeRates().then(setExchangeRates).catch(console.error)
    
    if (user?.id) {
      // Fetch favorites
      fetch(`/api/v2/renter/favorites?userId=${user.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            setUserFavorites(new Set(data.data.map(fav => fav.listing_id)))
          }
        })
        .catch(console.error)
      
      // Fetch bookings for map markers
      fetch(`/api/v2/bookings?renterId=${user.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) setUserBookings(data.data || [])
        })
        .catch(console.error)
    }
  }, [user?.id])
  
  useEffect(() => {
    const handler = (e) => setCurrency(e.detail)
    window.addEventListener('currency-change', handler)
    return () => window.removeEventListener('currency-change', handler)
  }, [])

  useEffect(() => {
    const handler = (e) => e?.detail && setLanguage(e.detail)
    window.addEventListener('language-change', handler)
    return () => window.removeEventListener('language-change', handler)
  }, [])
  
  // Initial fetch
  useEffect(() => {
    fetchListings(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  
  // Refetch on filter changes
  useEffect(() => {
    if (!loading) fetchListings(false)
  }, [debouncedQuery, selectedCategory, debouncedDistrict, debouncedDateRange, debouncedGuests]) // eslint-disable-line react-hooks/exhaustive-deps
  
  // URL sync
  useEffect(() => {
    const params = new URLSearchParams()
    if (debouncedQuery) params.set('q', debouncedQuery)
    if (selectedCategory !== 'all') params.set('category', selectedCategory)
    if (debouncedDistrict !== 'all') params.set('location', debouncedDistrict)
    if (debouncedDateRange.from) params.set('checkIn', format(debouncedDateRange.from, 'yyyy-MM-dd'))
    if (debouncedDateRange.to) params.set('checkOut', format(debouncedDateRange.to, 'yyyy-MM-dd'))
    if (debouncedGuests !== '1') params.set('guests', debouncedGuests)
    
    const url = params.toString() ? `/listings?${params.toString()}` : '/listings'
    window.history.replaceState({}, '', url)
  }, [debouncedQuery, selectedCategory, debouncedDistrict, debouncedDateRange, debouncedGuests])
  
  // Handlers
  const clearDates = () => setDateRange({ from: null, to: null })
  
  const handleFavorite = async (listingId, newIsFavorite) => {
    if (!user?.id) {
      toast.error(language === 'ru' ? 'Войдите, чтобы добавить в избранное' : 'Please login to add favorites')
      return
    }
    
    // Optimistic update
    setUserFavorites(prev => {
      const next = new Set(prev)
      newIsFavorite ? next.add(listingId) : next.delete(listingId)
      return next
    })
    
    try {
      const res = await fetch('/api/v2/favorites', {
        method: newIsFavorite ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId })
      })
      
      const data = await res.json()
      
      if (!data.success) {
        // Revert on error
        setUserFavorites(prev => {
          const next = new Set(prev)
          newIsFavorite ? next.delete(listingId) : next.add(listingId)
          return next
        })
        toast.error(language === 'ru' ? 'Ошибка обновления избранного' : 'Failed to update favorites')
      } else {
        toast.success(newIsFavorite 
          ? (language === 'ru' ? '❤️ Добавлено в избранное' : '❤️ Added to favorites')
          : (language === 'ru' ? 'Удалено из избранного' : 'Removed from favorites')
        )
      }
    } catch (error) {
      // Revert on error
      setUserFavorites(prev => {
        const next = new Set(prev)
        newIsFavorite ? next.delete(listingId) : next.add(listingId)
        return next
      })
      toast.error(language === 'ru' ? 'Ошибка сети' : 'Network error')
    }
  }
  
  // Memoized values
  const nights = useMemo(() => 
    dateRange.from && dateRange.to ? differenceInDays(dateRange.to, dateRange.from) : 0,
  [dateRange])
  
  const cardDates = useMemo(() => ({
    checkIn: dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : null,
    checkOut: dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : null
  }), [dateRange])
  
  const hasMore = displayedCount < allListings.length
  
  // Render
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
          <Badge variant="secondary" className="bg-teal-100 text-teal-700">
            {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : `${allListings.length}`}
          </Badge>
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar
        language={language}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        dateRange={dateRange}
        setDateRange={setDateRange}
        selectedDistrict={selectedDistrict}
        setSelectedDistrict={setSelectedDistrict}
        guests={guests}
        setGuests={setGuests}
        clearDates={clearDates}
        nights={nights}
      />

      {/* Results */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <ListingSidebar
            listings={listings}
            loading={loading}
            error={error}
            hasMore={hasMore}
            loadingMore={loadingMore}
            isTransitioning={isTransitioning}
            language={language}
            currency={currency}
            exchangeRates={exchangeRates}
            userFavorites={userFavorites}
            cardDates={cardDates}
            guests={guests}
            showMap={showMap}
            onFavorite={handleFavorite}
            onLoadMore={loadMore}
            onRetry={retry}
            onToggleMap={() => setShowMap(!showMap)}
            meta={meta}
            loadMoreRef={loadMoreRef}
            allListings={allListings}
            displayedCount={displayedCount}
          />

          <SearchMapWrapper
            listings={listings}
            userBookings={userBookings}
            userId={user?.id}
            language={language}
            showMap={showMap}
          />
        </div>
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
