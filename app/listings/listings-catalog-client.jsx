'use client'

/**
 * GoStayLo - Search Results Page (client)
 * @see app/listings/page.js — серверная оболочка (metadata, ItemList JSON-LD)
 */

import { useState, useEffect, useMemo, useRef, Suspense, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
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
import { normalizeListingCategorySlugForSearch, isTransportListingCategory } from '@/lib/listing-category-slug'
import {
  parseBBoxFromParams,
  bboxToSearchParams,
  parseExtraFiltersFromParams,
  appendExtraFiltersToParams,
  defaultExtraFilters,
} from '@/lib/search/listings-page-url'

const ITEMS_PER_PAGE = 12

function canonicalWhere(w) {
  if (w == null) return 'all'
  const s = String(w).trim()
  if (!s || s.toLowerCase() === 'all') return 'all'
  return s
}

function parseTimeParam(v, fallback = '07:00') {
  const s = String(v || '').trim()
  return /^\d{2}:\d{2}$/.test(s) ? s : fallback
}

function ListingsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useAuth()

  const [selectedCategory, setSelectedCategory] = useState(() =>
    normalizeListingCategorySlugForSearch(searchParams.get('category') || 'all'),
  )
  const [where, setWhereState] = useState(() =>
    canonicalWhere(
      searchParams.get('where') || searchParams.get('location') || searchParams.get('city') || 'all',
    ),
  )
  const setWhere = useCallback((w) => setWhereState(canonicalWhere(w)), [])
  const [guests, setGuests] = useState(searchParams.get('guests') || '2')
  const [dateRange, setDateRange] = useState({
    from: searchParams.get('checkIn') ? parseISO(searchParams.get('checkIn')) : null,
    to: searchParams.get('checkOut') ? parseISO(searchParams.get('checkOut')) : null,
  })
  const [checkInTime, setCheckInTime] = useState(() => parseTimeParam(searchParams.get('checkInTime')))
  const [checkOutTime, setCheckOutTime] = useState(() => parseTimeParam(searchParams.get('checkOutTime')))

  const searchParamsKey = searchParams.toString()
  const urlSyncDidMount = useRef(false)
  useEffect(() => {
    if (!urlSyncDidMount.current) {
      urlSyncDidMount.current = true
      return
    }
    setSelectedCategory(normalizeListingCategorySlugForSearch(searchParams.get('category') || 'all'))
    setWhereState(
      canonicalWhere(
        searchParams.get('where') ||
          searchParams.get('location') ||
          searchParams.get('city') ||
          'all',
      ),
    )
    setGuests(searchParams.get('guests') || '2')
    setDateRange({
      from: searchParams.get('checkIn') ? parseISO(searchParams.get('checkIn')) : null,
      to: searchParams.get('checkOut') ? parseISO(searchParams.get('checkOut')) : null,
    })
    setCheckInTime(parseTimeParam(searchParams.get('checkInTime')))
    setCheckOutTime(parseTimeParam(searchParams.get('checkOutTime')))
    setSearchQuery(searchParams.get('q') || '')
    const sem = searchParams.get('semantic')
    if (sem === '0') setSmartSearchOn(false)
    else if (sem === '1') setSmartSearchOn(true)
  }, [searchParamsKey])

  const [language, setLanguage] = useState('en')
  const [currency, setCurrency] = useState('THB')
  const [exchangeRates, setExchangeRates] = useState({ THB: 1 })
  const [showMap, setShowMap] = useState(false)
  const [userFavorites, setUserFavorites] = useState(new Set())
  const [userBookings, setUserBookings] = useState([])
  const [appliedBbox, setAppliedBbox] = useState(null)
  const [extraFilters, setExtraFilters] = useState(() => defaultExtraFilters())
  const [mapSelectedListingId, setMapSelectedListingId] = useState(null)
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '')
  const [smartSearchOn, setSmartSearchOn] = useState(() => {
    const sem = searchParams.get('semantic')
    if (sem === '0') return false
    if (sem === '1') return true
    if (typeof window !== 'undefined') {
      try {
        const ls = localStorage.getItem('gostaylo_smart_search')
        if (ls === '0') return false
        if (ls === '1') return true
      } catch {
        /* ignore */
      }
    }
    return true
  })
  const [semanticSiteEnabled, setSemanticSiteEnabled] = useState(true)

  const lastPushedSearchRef = useRef('')
  const didInitUrlHydrateRef = useRef(false)
  const skipNextUrlPushRef = useRef(false)

  const mapFitResetKey = useMemo(
    () =>
      [
        selectedCategory,
        where,
        dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : '',
        dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : '',
        isTransportListingCategory(selectedCategory) ? checkInTime : '',
        isTransportListingCategory(selectedCategory) ? checkOutTime : '',
        guests,
      ].join('|'),
    [selectedCategory, where, dateRange.from, dateRange.to, checkInTime, checkOutTime, guests],
  )

  useEffect(() => {
    setAppliedBbox(null)
  }, [mapFitResetKey])

  useEffect(() => {
    const incoming = searchParams.toString()
    if (!didInitUrlHydrateRef.current) {
      didInitUrlHydrateRef.current = true
      lastPushedSearchRef.current = incoming
      setExtraFilters(parseExtraFiltersFromParams(searchParams))
      setAppliedBbox(parseBBoxFromParams(searchParams))
      skipNextUrlPushRef.current = true
      return
    }
    if (incoming === lastPushedSearchRef.current) return
    lastPushedSearchRef.current = incoming
    setExtraFilters(parseExtraFiltersFromParams(searchParams))
    setAppliedBbox(parseBBoxFromParams(searchParams))
  }, [searchParamsKey, searchParams])

  useEffect(() => {
    if (!mapSelectedListingId) return
    const t = setTimeout(() => setMapSelectedListingId(null), 5000)
    return () => clearTimeout(t)
  }, [mapSelectedListingId])

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

  const handleSearchThisArea = useCallback((b) => {
    setAppliedBbox(b)
  }, [])

  const handleClearMapBounds = useCallback(() => {
    setAppliedBbox(null)
  }, [])

  const handleListingMarkerClick = useCallback((id) => {
    setMapSelectedListingId(id)
  }, [])

  const debouncedWhere = useDebounce(where)
  const debouncedGuests = useDebounce(guests)
  const debouncedDateRange = useDebounce(dateRange)
  const debouncedSearchQuery = useDebounce(searchQuery, 400)

  const [initialSemanticFromUrl] = useState(() => {
    const s = searchParams.get('semantic')
    const q = searchParams.get('q')
    return s === '1' && (q || '').trim().length >= 2
  })

  const [aiSearchPending, setAiSearchPending] = useState(false)

  const appliedBboxKey = useMemo(() => {
    if (!appliedBbox) return `none::${mapFitResetKey}`
    return [
      appliedBbox.south.toFixed(5),
      appliedBbox.north.toFixed(5),
      appliedBbox.west.toFixed(5),
      appliedBbox.east.toFixed(5),
      mapFitResetKey,
    ].join('|')
  }, [appliedBbox, mapFitResetKey])

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
    commitSemanticSearch,
    loadMore,
    retry,
  } = useListingsFetch({
    selectedCategory,
    debouncedWhere,
    debouncedDateRange,
    debouncedGuests,
    checkInTime,
    checkOutTime,
    appliedMapBounds: appliedBbox,
    extraFilters,
    debouncedTextQuery: debouncedSearchQuery,
    liveTextQuery: searchQuery,
    smartSearchOn,
    semanticSiteEnabled,
    initialSemanticFromUrl,
    itemsPerPage: ITEMS_PER_PAGE,
  })

  const handleCatalogSearchSubmit = useCallback(() => {
    if (smartSearchOn && semanticSiteEnabled && searchQuery.trim().length >= 2) {
      setAiSearchPending(true)
    }
    commitSemanticSearch()
  }, [smartSearchOn, semanticSiteEnabled, searchQuery, commitSemanticSearch])

  useEffect(() => {
    if (!loading) setAiSearchPending(false)
  }, [loading])

  useEffect(() => {
    if (!mapSelectedListingId) return
    if (!allListings.some((l) => l.id === mapSelectedListingId)) {
      setMapSelectedListingId(null)
    }
  }, [allListings, mapSelectedListingId])

  const loadMoreRef = useIntersectionObserver(loadMore)

  useEffect(() => {
    setLanguage(detectLanguage())

    const storedCurrency = localStorage.getItem('gostaylo_currency')
    if (storedCurrency) setCurrency(storedCurrency)

    fetchExchangeRates().then(setExchangeRates).catch(console.error)

    if (user?.id) {
      fetch(`/api/v2/renter/favorites?userId=${user.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data) {
            setUserFavorites(new Set(data.data.map((fav) => fav.listing_id)))
          }
        })
        .catch(console.error)

      fetch(`/api/v2/bookings?renterId=${user.id}`)
        .then((res) => res.json())
        .then((data) => {
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

  useEffect(() => {
    fetchListings(true)
  }, [])

  useEffect(() => {
    if (!loading) fetchListings(false)
  }, [
    debouncedWhere,
    selectedCategory,
    debouncedDateRange,
    debouncedGuests,
    debouncedSearchQuery,
    appliedBbox,
    extraFilters,
  ])

  useEffect(() => {
    if (skipNextUrlPushRef.current) {
      skipNextUrlPushRef.current = false
      return
    }
    const params = new URLSearchParams()
    if (selectedCategory !== 'all') params.set('category', selectedCategory)
    if (debouncedWhere !== 'all') params.set('where', debouncedWhere)
    if (debouncedDateRange.from) params.set('checkIn', format(debouncedDateRange.from, 'yyyy-MM-dd'))
    if (debouncedDateRange.to) params.set('checkOut', format(debouncedDateRange.to, 'yyyy-MM-dd'))
    if (
      isTransportListingCategory(selectedCategory) &&
      debouncedDateRange.from &&
      debouncedDateRange.to
    ) {
      params.set('checkInTime', checkInTime)
      params.set('checkOutTime', checkOutTime)
    }
    if (debouncedGuests !== '1') params.set('guests', debouncedGuests)
    const qt = debouncedSearchQuery.trim()
    if (qt.length >= 2) params.set('q', qt)
    bboxToSearchParams(appliedBbox, params)
    appendExtraFiltersToParams(params, extraFilters)
    const s = params.toString()
    if (s === lastPushedSearchRef.current) return
    lastPushedSearchRef.current = s
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false })
  }, [
    router,
    pathname,
    selectedCategory,
    debouncedWhere,
    debouncedDateRange,
    debouncedGuests,
    checkInTime,
    checkOutTime,
    debouncedSearchQuery,
    appliedBbox,
    extraFilters,
  ])

  const clearDates = () => setDateRange({ from: null, to: null })

  const handleFavorite = async (listingId, newIsFavorite) => {
    if (!user?.id) {
      toast.error(language === 'ru' ? 'Войдите, чтобы добавить в избранное' : 'Please login to add favorites')
      return
    }

    setUserFavorites((prev) => {
      const next = new Set(prev)
      newIsFavorite ? next.add(listingId) : next.delete(listingId)
      return next
    })

    try {
      const res = await fetch('/api/v2/favorites', {
        method: newIsFavorite ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId }),
      })

      const data = await res.json()

      if (!data.success) {
        setUserFavorites((prev) => {
          const next = new Set(prev)
          newIsFavorite ? next.delete(listingId) : next.add(listingId)
          return next
        })
        toast.error(language === 'ru' ? 'Ошибка обновления избранного' : 'Failed to update favorites')
      } else {
        toast.success(
          newIsFavorite
            ? language === 'ru'
              ? '❤️ Добавлено в избранное'
              : '❤️ Added to favorites'
            : language === 'ru'
              ? 'Удалено из избранного'
              : 'Removed from favorites',
        )
      }
    } catch {
      setUserFavorites((prev) => {
        const next = new Set(prev)
        newIsFavorite ? next.delete(listingId) : next.add(listingId)
        return next
      })
      toast.error(language === 'ru' ? 'Ошибка сети' : 'Network error')
    }
  }

  const nights = useMemo(
    () => (dateRange.from && dateRange.to ? differenceInDays(dateRange.to, dateRange.from) : 0),
    [dateRange],
  )

  const transportBroadenHref = useMemo(() => {
    if (!isTransportListingCategory(selectedCategory)) return null
    const params = new URLSearchParams()
    params.set('category', 'vehicles')
    if (dateRange.from) params.set('checkIn', format(dateRange.from, 'yyyy-MM-dd'))
    if (dateRange.to) params.set('checkOut', format(dateRange.to, 'yyyy-MM-dd'))
    if (dateRange.from && dateRange.to) {
      params.set('checkInTime', checkInTime)
      params.set('checkOutTime', checkOutTime)
    }
    return `/listings?${params.toString()}`
  }, [selectedCategory, dateRange.from, dateRange.to, checkInTime, checkOutTime])

  const cardDates = useMemo(
    () => ({
      checkIn: dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : null,
      checkOut: dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : null,
    }),
    [dateRange],
  )

  const hasMore = displayedCount < allListings.length

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white shadow-sm sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-teal-600 transition-colors">
            <ArrowLeft className="h-5 w-5" />
            <span className="hidden sm:inline">{language === 'ru' ? 'На главную' : 'Back'}</span>
          </Link>
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center text-white font-bold">G</div>
            <span className="font-semibold text-lg hidden sm:inline">GoStayLo</span>
          </Link>
          <Badge variant="secondary" className="bg-teal-100 text-teal-700">
            {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : `${allListings.length}`}
          </Badge>
        </div>
      </div>

      <FilterBar
        language={language}
        dateRange={dateRange}
        setDateRange={setDateRange}
        checkInTime={checkInTime}
        setCheckInTime={setCheckInTime}
        checkOutTime={checkOutTime}
        setCheckOutTime={setCheckOutTime}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        where={where}
        setWhere={setWhere}
        guests={guests}
        setGuests={setGuests}
        clearDates={clearDates}
        nights={nights}
        extraFilters={extraFilters}
        onExtraFiltersChange={setExtraFilters}
        listingsForFiltersHistogram={allListings}
        filterResultCount={allListings.length}
        textQuery={searchQuery}
        setTextQuery={setSearchQuery}
        smartSearchOn={smartSearchOn}
        setSmartSearchOn={setSmartSearchOn}
        semanticSearchFeatureEnabled={semanticSiteEnabled}
        onSearchSubmit={handleCatalogSearchSubmit}
      />

      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row lg:items-stretch gap-6">
          <div className="w-full min-w-0 lg:w-[60%] lg:max-w-[60%] lg:flex-shrink-0">
            <ListingSidebar
              listings={listings}
              loading={loading}
              aiSearchPending={aiSearchPending}
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
              selectedCategory={selectedCategory}
              filterWhere={where}
              transportBroadenHref={transportBroadenHref}
              highlightedListingId={mapSelectedListingId}
            />
          </div>

          <SearchMapWrapper
            listings={allListings}
            userBookings={userBookings}
            userId={user?.id}
            language={language}
            showMap={showMap}
            currency={currency}
            exchangeRates={exchangeRates}
            selectedListingId={mapSelectedListingId}
            onListingMarkerClick={handleListingMarkerClick}
            onSearchThisArea={handleSearchThisArea}
            mapBoundsLocked={!!appliedBbox}
            onClearMapBounds={handleClearMapBounds}
            appliedBboxKey={appliedBboxKey}
            mapFitResetKey={mapFitResetKey}
          />
        </div>
      </div>
    </div>
  )
}

export default function ListingsCatalogClient() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      }
    >
      <ListingsContent />
    </Suspense>
  )
}
