'use client'

/**
 * GostayloHomeContent — домашняя страница: секции в `components/home/`, фильтры в `useHomeFilters`.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, isSameDay, differenceInDays } from 'date-fns'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { fetchCategories, fetchExchangeRates } from '@/lib/client-data'
import {
  detectLanguage,
  setLanguage as persistLanguage,
  getCategoryName,
  getUIText,
} from '@/lib/translations'
import { LISTINGS_SEARCH_API_PATH } from '@/lib/search-endpoints'
import { isTransportListingCategory } from '@/lib/listing-category-slug'
import { useHomeFilters } from '@/components/home/useHomeFilters'
import { HomeHero } from '@/components/home/HomeHero'
import { CategoryBar } from '@/components/home/CategoryBar'
import { TopListingsGrid } from '@/components/home/TopListingsGrid'

export function GostayloHomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user: authUser, openLoginModal } = useAuth()

  const filters = useHomeFilters()
  const {
    selectedCategory,
    setSelectedCategory,
    where,
    setWhere,
    dateRange,
    setDateRange,
    checkInTime,
    setCheckInTime,
    checkOutTime,
    setCheckOutTime,
    guests,
    setGuests,
    searchQuery,
    setSearchQuery,
    smartSearchOn,
    setSmartSearchOn,
    semanticSiteEnabled,
    pendingHomeSemanticRef,
    aiGridPending,
    setAiGridPending,
    debouncedDateRange,
    debouncedWhere,
    debouncedGuests,
    debouncedSearchQuery,
    transportSearchMode,
  } = filters

  const [currency, setCurrency] = useState('THB')
  const [language, setLanguageState] = useState('ru')
  const [categories, setCategories] = useState([])
  const [listings, setListings] = useState([])
  const [exchangeRates, setExchangeRates] = useState({})
  const [loading, setLoading] = useState(true)
  const [listingsLoading, setListingsLoading] = useState(false)

  const [liveCount, setLiveCount] = useState(null)
  const [countLoading, setCountLoading] = useState(false)

  const [mediaFallback, setMediaFallback] = useState({})
  const markMediaFailed = useCallback((key) => {
    setMediaFallback((m) => (m[key] ? m : { ...m, [key]: true }))
  }, [])

  useEffect(() => {
    if (authUser && typeof window !== 'undefined') {
      try {
        localStorage.setItem('gostaylo_user', JSON.stringify(authUser))
      } catch {
        /* ignore */
      }
    }
  }, [authUser])

  useEffect(() => {
    if (searchParams?.get('login') === 'true') {
      openLoginModal?.('login')
      window.history.replaceState({}, '', '/')
    }
    if (searchParams?.get('verified') === 'success') {
      toast.success(language === 'ru' ? 'Email подтверждён!' : 'Email verified!')
      window.history.replaceState({}, '', '/')
      fetch('/api/v2/auth/me', { credentials: 'include' })
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.user) {
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
    window.addEventListener('languageChange', handleLang)
    return () => {
      window.removeEventListener('language-change', handleLang)
      window.removeEventListener('languageChange', handleLang)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedCurrency = localStorage.getItem('gostaylo_currency')
    if (savedCurrency) setCurrency(savedCurrency)
    const handleCurrencyChange = (e) => setCurrency(e.detail)
    window.addEventListener('currency-change', handleCurrencyChange)
    return () => window.removeEventListener('currency-change', handleCurrencyChange)
  }, [])

  useEffect(() => {
    Promise.all([fetchCategories(), fetchExchangeRates()])
      .then(([cats, rates]) => {
        setCategories(cats)
        setExchangeRates(rates)
      })
      .catch(console.error)
  }, [])

  const fetchListingsData = useCallback(
    async (showLoading = true) => {
      if (showLoading) setListingsLoading(true)

      try {
        const params = new URLSearchParams({ limit: '12', featured: 'true' })
        if (selectedCategory && selectedCategory !== 'all') params.set('category', selectedCategory)
        if (where && where !== 'all') params.set('where', where)
        if (dateRange.from && dateRange.to && !isSameDay(dateRange.from, dateRange.to)) {
          params.set('checkIn', format(dateRange.from, 'yyyy-MM-dd'))
          params.set('checkOut', format(dateRange.to, 'yyyy-MM-dd'))
          if (transportSearchMode) {
            params.set('checkInTime', checkInTime)
            params.set('checkOutTime', checkOutTime)
          }
        }
        if (guests && guests !== '1') params.set('guests', guests)
        const useSem = pendingHomeSemanticRef.current && semanticSiteEnabled && smartSearchOn
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
    },
    [
      selectedCategory,
      where,
      dateRange,
      guests,
      debouncedSearchQuery,
      searchQuery,
      semanticSiteEnabled,
      smartSearchOn,
      transportSearchMode,
      checkInTime,
      checkOutTime,
    ],
  )

  useEffect(() => {
    fetchListingsData()
  }, [fetchListingsData])

  useEffect(() => {
    if (!loading) fetchListingsData(false)
  }, [debouncedDateRange, debouncedWhere, debouncedGuests, debouncedSearchQuery, loading, fetchListingsData])

  const fetchLiveCount = useCallback(
    async (dr, w, g, cat) => {
      setCountLoading(true)
      try {
        const params = new URLSearchParams({ limit: '50' })
        if (cat && cat !== 'all') params.set('category', cat)
        if (w && w !== 'all') params.set('where', w)
        if (dr?.from && dr?.to && !isSameDay(dr.from, dr.to)) {
          params.set('checkIn', format(dr.from, 'yyyy-MM-dd'))
          params.set('checkOut', format(dr.to, 'yyyy-MM-dd'))
          if (isTransportListingCategory(cat)) {
            params.set('checkInTime', checkInTime)
            params.set('checkOutTime', checkOutTime)
          }
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
    },
    [searchQuery, checkInTime, checkOutTime],
  )

  const handleSearch = useCallback(() => {
    const params = new URLSearchParams()
    if (selectedCategory && selectedCategory !== 'all') params.set('category', selectedCategory)
    if (where && where !== 'all') params.set('where', where)
    if (dateRange.from) params.set('checkIn', format(dateRange.from, 'yyyy-MM-dd'))
    if (dateRange.to && !isSameDay(dateRange.from, dateRange.to)) params.set('checkOut', format(dateRange.to, 'yyyy-MM-dd'))
    if (transportSearchMode && dateRange.from && dateRange.to && !isSameDay(dateRange.from, dateRange.to)) {
      params.set('checkInTime', checkInTime)
      params.set('checkOutTime', checkOutTime)
    }
    if (guests && guests !== '1') params.set('guests', guests)
    const qt = searchQuery.trim()
    if (qt.length >= 2) params.set('q', qt)
    if (semanticSiteEnabled) params.set('semantic', smartSearchOn ? '1' : '0')
    router.push(params.toString() ? `/listings?${params.toString()}` : '/listings')
  }, [
    selectedCategory,
    where,
    dateRange,
    guests,
    searchQuery,
    semanticSiteEnabled,
    smartSearchOn,
    router,
    transportSearchMode,
    checkInTime,
    checkOutTime,
  ])

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

  const handleDateChange = useCallback(
    (newRange) => {
      setDateRange(newRange)
      if (newRange.from && newRange.to) {
        fetchLiveCount(newRange, where, guests, selectedCategory)
      }
    },
    [where, guests, selectedCategory, fetchLiveCount, setDateRange],
  )

  useEffect(() => {
    if (dateRange.from && dateRange.to) {
      fetchLiveCount(dateRange, where, guests, selectedCategory)
    }
  }, [debouncedSearchQuery, dateRange, where, guests, selectedCategory, fetchLiveCount])

  const goToListingsForCategory = useCallback(
    (categorySlug) => {
      setSelectedCategory(categorySlug)
      const params = new URLSearchParams()
      params.set('category', categorySlug)
      if (where !== 'all') params.set('where', where)
      if (dateRange.from) params.set('checkIn', format(dateRange.from, 'yyyy-MM-dd'))
      if (dateRange.to && !isSameDay(dateRange.from, dateRange.to)) {
        params.set('checkOut', format(dateRange.to, 'yyyy-MM-dd'))
      }
      if (
        isTransportListingCategory(categorySlug) &&
        dateRange.from &&
        dateRange.to &&
        !isSameDay(dateRange.from, dateRange.to)
      ) {
        params.set('checkInTime', checkInTime)
        params.set('checkOutTime', checkOutTime)
      }
      if (guests !== '1') params.set('guests', guests)
      const qt = searchQuery.trim()
      if (qt.length >= 2) params.set('q', qt)
      if (semanticSiteEnabled) params.set('semantic', smartSearchOn ? '1' : '0')
      router.push(`/listings?${params.toString()}`)
    },
    [
      setSelectedCategory,
      where,
      dateRange,
      guests,
      searchQuery,
      semanticSiteEnabled,
      smartSearchOn,
      router,
      checkInTime,
      checkOutTime,
    ],
  )

  const onCategorySelect = useCallback((cat) => goToListingsForCategory(cat.slug), [goToListingsForCategory])

  const handleQuickCategorySearch = useCallback(
    (slug) => goToListingsForCategory(slug),
    [goToListingsForCategory],
  )

  const nights = useMemo(
    () => (dateRange.from && dateRange.to ? differenceInDays(dateRange.to, dateRange.from) : 0),
    [dateRange],
  )

  const searchBarRest = useMemo(
    () => ({
      category: selectedCategory,
      setCategory: setSelectedCategory,
      where,
      setWhere,
      dateRange,
      setDateRange: handleDateChange,
      checkInTime,
      setCheckInTime,
      checkOutTime,
      setCheckOutTime,
      guests,
      setGuests,
      onSearch: handleSearch,
      onQuickCategorySearch: handleQuickCategorySearch,
      textQuery: searchQuery,
      setTextQuery: setSearchQuery,
      smartSearchOn,
      setSmartSearchOn,
      semanticSearchFeatureEnabled: semanticSiteEnabled,
      onSearchSubmit: handleHomeSearchSubmit,
      liveCount,
      countLoading,
      nights,
    }),
    [
      selectedCategory,
      setSelectedCategory,
      where,
      dateRange,
      handleDateChange,
      checkInTime,
      checkOutTime,
      guests,
      handleSearch,
      handleQuickCategorySearch,
      searchQuery,
      setSearchQuery,
      smartSearchOn,
      setSmartSearchOn,
      semanticSiteEnabled,
      handleHomeSearchSubmit,
      liveCount,
      countLoading,
      nights,
      setCheckInTime,
      setCheckOutTime,
      setGuests,
      setWhere,
    ],
  )

  return (
    <div className="min-h-screen bg-white">
      <HomeHero language={language} searchBarRest={searchBarRest} />

      <CategoryBar
        language={language}
        categories={categories}
        mediaFallback={mediaFallback}
        onCategorySelect={onCategorySelect}
        markMediaFailed={markMediaFailed}
      />

      <TopListingsGrid
        language={language}
        dateRange={dateRange}
        guests={guests}
        checkInTime={checkInTime}
        checkOutTime={checkOutTime}
        listings={listings}
        loading={loading}
        listingsLoading={listingsLoading}
        aiGridPending={aiGridPending}
        exchangeRates={exchangeRates}
        currency={currency}
        nights={nights}
        mediaFallback={mediaFallback}
        markMediaFailed={markMediaFailed}
        onViewAll={handleSearch}
      />

      <footer className="bg-slate-900 text-white py-10">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="col-span-2 md:col-span-1">
              <div className="flex flex-col leading-none mb-3">
                <span className="text-xl font-black text-white tracking-tight">Go</span>
                <span className="text-xl font-black text-teal-400 tracking-tight ml-4 -mt-1">staylo</span>
              </div>
              <p className="text-slate-400 text-sm">{getUIText('footerDesc', language)}</p>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">{getUIText('footerCategories', language)}</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                {categories.map((c) => (
                  <li key={c.id}>{getCategoryName(c.slug, language, c.name)}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">{getUIText('footerCompany', language)}</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>{getUIText('aboutUs', language)}</li>
                <li>{getUIText('contactUs', language)}</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">{getUIText('footerSupport', language)}</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>{getUIText('helpCenter', language)}</li>
                <li>{getUIText('terms', language)}</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-6 text-center text-sm text-slate-400">
            <p>© 2025 GoStayLo. {getUIText('allRightsReserved', language)}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
