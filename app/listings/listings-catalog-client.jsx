'use client'

/**
 * GoStayLo - Search Results Page (client)
 * @see app/listings/page.js — серверная оболочка (metadata, ItemList JSON-LD)
 */

import { useState, useEffect, useMemo, useRef, Suspense, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { ListingsCatalogSkeleton } from '@/components/listings-catalog-skeleton'
import { format, parseISO, differenceInDays } from 'date-fns'
import { useFxRatesQuery } from '@/lib/hooks/use-fx-rates-query'
import { FilterBar } from '@/components/search/FilterBar'
import { ListingSidebar } from '@/components/search/ListingSidebar'
import { SearchMapWrapper } from '@/components/search/SearchMapWrapper'
import { CatalogMobileMapSheet } from '@/components/search/CatalogMobileMapSheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { recordPwaEngagement } from '@/lib/pwa/pwa-install-storage.js'
import { deferPwaPrompt, resumePwaPrompt } from '@/lib/pwa/pwa-prompt-defer.js'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'
import { useDebounce, useIntersectionObserver, useListingsFetch } from '@/lib/hooks/useListingsSearch'
import { usePublicCategoriesQuery } from '@/lib/hooks/use-public-catalog-queries'
import { useListingDetailPrefetch } from '@/lib/hooks/use-listing-detail-prefetch'
import { detectLanguage, DEFAULT_UI_LANGUAGE, getUIText } from '@/lib/translations'
import { normalizeListingCategorySlugForSearch } from '@/lib/listing-category-slug'
import { effectiveCategoryWizardProfileRaw } from '@/lib/config/category-hierarchy'
import { getCatalogSearchHeadlines } from '@/lib/search/catalog-search-headlines'
import { isCatalogTransportIntervalMode } from '@/lib/search/catalog-transport-interval'
import {
  parseBBoxFromParams,
  bboxToSearchParams,
  parseExtraFiltersFromParams,
  appendExtraFiltersToParams,
  defaultExtraFilters,
  parseCatalogSortFromParams,
} from '@/lib/search/listings-page-url'
import { resolveCatalogSortCenter } from '@/lib/geo/catalog-sort-centers'
import { ReferralCatalogFunnelStrip } from '@/components/referral/ReferralCatalogFunnelStrip'
import { trackProductEvent, ProductAnalyticsEvents } from '@/lib/analytics/product-analytics.js'
import { ForYouRail } from '@/components/recommendations/ForYouRail'
import { useFavoritesBatch } from '@/hooks/use-favorites-batch'

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
  const isMobile = useIsMobile()

  const [selectedCategory, setSelectedCategory] = useState(() =>
    normalizeListingCategorySlugForSearch(searchParams.get('category') || 'all'),
  )
  const [where, setWhereState] = useState(() =>
    canonicalWhere(
      searchParams.get('where') || searchParams.get('location') || searchParams.get('city') || 'all',
    ),
  )
  const setWhere = useCallback((w) => setWhereState(canonicalWhere(w)), [])
  const [guests, setGuests] = useState(searchParams.get('guests') || '1')
  const [guestsBreakdown, setGuestsBreakdown] = useState(() => {
    const total = Math.max(1, parseInt(searchParams.get('guests') || '1', 10) || 1)
    return { adults: total, children: 0, infants: 0 }
  })
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
    const nextGuests = searchParams.get('guests') || '1'
    setGuests(nextGuests)
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
    setCatalogSort(parseCatalogSortFromParams(searchParams))
  }, [searchParamsKey])

  useEffect(() => {
    const total = Math.max(1, parseInt(guests, 10) || 1)
    const currentTotal =
      Math.max(1, parseInt(guestsBreakdown?.adults, 10) || 1) +
      Math.max(0, parseInt(guestsBreakdown?.children, 10) || 0) +
      Math.max(0, parseInt(guestsBreakdown?.infants, 10) || 0)
    if (currentTotal === total) return
    setGuestsBreakdown({ adults: total, children: 0, infants: 0 })
  }, [guests, guestsBreakdown])

  const [language, setLanguage] = useState(DEFAULT_UI_LANGUAGE)
  const { data: catalogCategories = [] } = usePublicCategoriesQuery()
  const { prefetchListingDetail, cancelListingDetailPrefetch } = useListingDetailPrefetch()
  const [currency, setCurrency] = useState('THB')
  const { data: exchangeRates = { THB: 1 } } = useFxRatesQuery({ retail: true })
  const [showMap, setShowMap] = useState(false)
  const [userBookings, setUserBookings] = useState([])
  const [appliedBbox, setAppliedBbox] = useState(null)
  const [extraFilters, setExtraFilters] = useState(() => defaultExtraFilters())
  const [mapSelectedListingId, setMapSelectedListingId] = useState(null)
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '')
  const [catalogSort, setCatalogSort] = useState(() => parseCatalogSortFromParams(searchParams))
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

  /** Slug → эффективный `wizard_profile` (колонка или наследование от родителя, Stage 68.0). */
  const wizardProfileBySlug = useMemo(() => {
    const m = {}
    for (const c of catalogCategories || []) {
      if (!c?.slug) continue
      const s = String(c.slug).toLowerCase()
      m[s] = effectiveCategoryWizardProfileRaw(s, catalogCategories)
    }
    return m
  }, [catalogCategories])

  const selectedCategoryWizardProfile = useMemo(() => {
    if (!selectedCategory || selectedCategory === 'all') return null
    return effectiveCategoryWizardProfileRaw(selectedCategory, catalogCategories)
  }, [selectedCategory, catalogCategories])

  const catalogHeadlines = useMemo(
    () => getCatalogSearchHeadlines(selectedCategory, catalogCategories, language),
    [selectedCategory, catalogCategories, language],
  )

  const lastPushedSearchRef = useRef('')
  const didInitUrlHydrateRef = useRef(false)
  const skipNextUrlPushRef = useRef(false)
  const catalogSortRef = useRef(catalogSort)

  const mapFitResetKey = useMemo(
    () =>
      [
        selectedCategory,
        where,
        dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : '',
        dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : '',
        isCatalogTransportIntervalMode(selectedCategory, wizardProfileBySlug) ? checkInTime : '',
        isCatalogTransportIntervalMode(selectedCategory, wizardProfileBySlug) ? checkOutTime : '',
        guests,
      ].join('|'),
    [
      selectedCategory,
      where,
      dateRange.from,
      dateRange.to,
      checkInTime,
      checkOutTime,
      guests,
      wizardProfileBySlug,
    ],
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

  const handleListingCardSelect = useCallback((id) => {
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
    commitSemanticSearch,
    loadMore,
    retry,
    searchKeyParams,
  } = useListingsFetch({
    selectedCategory,
    categoryWizardProfile: selectedCategoryWizardProfile,
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
    displayCurrency: currency,
    catalogSort,
  })

  const visibleListingIds = useMemo(() => listings.map((listing) => listing.id), [listings])
  const { favoriteIds: userFavorites, applyOptimisticFavorite } = useFavoritesBatch({
    userId: user?.id,
    listingIds: visibleListingIds,
  })

  useEffect(() => {
    if (!isMobile) return
    if (showMap) {
      recordPwaEngagement('map_open')
      deferPwaPrompt()
      return () => resumePwaPrompt()
    }
    return undefined
  }, [isMobile, showMap])

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

  const catalogSortDistanceAvailable = useMemo(
    () => Boolean(resolveCatalogSortCenter({ where: debouncedWhere, bounds: appliedBbox })),
    [debouncedWhere, appliedBbox],
  )

  useEffect(() => {
    catalogSortRef.current = catalogSort
  }, [catalogSort])

  useEffect(() => {
    if (catalogSort !== 'distance') return
    if (!catalogSortDistanceAvailable) setCatalogSort('recommended')
  }, [catalogSort, catalogSortDistanceAvailable])

  const handleCatalogSortChange = useCallback(
    (next) => {
      const prev = catalogSortRef.current
      if (prev === next) return
      void trackProductEvent(ProductAnalyticsEvents.CATALOG_SORT_CHANGE, {
        from_sort: prev,
        to_sort: next,
        ...(debouncedWhere && debouncedWhere !== 'all' ? { where: debouncedWhere } : {}),
        has_bbox: Boolean(appliedBbox),
      })
      setCatalogSort(next)
    },
    [debouncedWhere, appliedBbox],
  )

  const loadMoreRef = useIntersectionObserver(loadMore)

  useEffect(() => {
    setLanguage(detectLanguage())

    const storedCurrency = localStorage.getItem('gostaylo_currency')
    if (storedCurrency) setCurrency(storedCurrency)

    if (user?.id) {
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
      isCatalogTransportIntervalMode(selectedCategory, wizardProfileBySlug) &&
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
    if (catalogSort && catalogSort !== 'recommended') params.set('sort', catalogSort)
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
    wizardProfileBySlug,
    catalogSort,
  ])

  const clearDates = () => setDateRange({ from: null, to: null })

  const handleFavorite = async (listingId, newIsFavorite) => {
    if (!user?.id) {
      toast.error(getUIText('favoriteLoginRequired', language))
      return
    }

    applyOptimisticFavorite(listingId, newIsFavorite)

    try {
      const res = await fetch('/api/v2/favorites', {
        method: newIsFavorite ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId }),
      })

      const data = await res.json()

      if (!data.success) {
        applyOptimisticFavorite(listingId, !newIsFavorite)
        toast.error(getUIText('favoriteUpdateError', language))
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
      applyOptimisticFavorite(listingId, !newIsFavorite)
      toast.error(getUIText('networkError', language))
    }
  }

  const nights = useMemo(
    () => (dateRange.from && dateRange.to ? differenceInDays(dateRange.to, dateRange.from) : 0),
    [dateRange],
  )

  const transportBroadenHref = useMemo(() => {
    if (!isCatalogTransportIntervalMode(selectedCategory, wizardProfileBySlug)) return null
    const params = new URLSearchParams()
    params.set('category', 'vehicles')
    if (dateRange.from) params.set('checkIn', format(dateRange.from, 'yyyy-MM-dd'))
    if (dateRange.to) params.set('checkOut', format(dateRange.to, 'yyyy-MM-dd'))
    if (dateRange.from && dateRange.to) {
      params.set('checkInTime', checkInTime)
      params.set('checkOutTime', checkOutTime)
    }
    return `/listings?${params.toString()}`
  }, [selectedCategory, dateRange.from, dateRange.to, checkInTime, checkOutTime, wizardProfileBySlug])

  const cardDates = useMemo(
    () => ({
      checkIn: dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : null,
      checkOut: dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : null,
      checkInTime,
      checkOutTime,
    }),
    [dateRange, checkInTime, checkOutTime],
  )

  const catalogMapPanelProps = useMemo(
    () => ({
      listings: allListings,
      searchKeyParams,
      appliedBbox,
      userBookings,
      userId: user?.id ?? null,
      language,
      currency,
      exchangeRates,
      initialDates: cardDates,
      selectedListingId: mapSelectedListingId,
      onListingMarkerClick: handleListingMarkerClick,
      onSearchThisArea: handleSearchThisArea,
      mapBoundsLocked: !!appliedBbox,
      onClearMapBounds: handleClearMapBounds,
      appliedBboxKey,
      mapFitResetKey,
    }),
    [
      allListings,
      searchKeyParams,
      appliedBbox,
      userBookings,
      user?.id,
      language,
      currency,
      exchangeRates,
      cardDates,
      mapSelectedListingId,
      handleListingMarkerClick,
      handleSearchThisArea,
      handleClearMapBounds,
      appliedBboxKey,
      mapFitResetKey,
    ],
  )

  const hasMore = displayedCount < allListings.length

  return (
    <div className="min-h-screen bg-slate-50">
      <FilterBar
        language={language}
        dateRange={dateRange}
        setDateRange={setDateRange}
        checkInTime={checkInTime}
        setCheckInTime={setCheckInTime}
        checkOutTime={checkOutTime}
        setCheckOutTime={setCheckOutTime}
        categoriesForHierarchy={catalogCategories}
        catalogHeadline={catalogHeadlines.h1}
        catalogSubline={catalogHeadlines.sub}
        catalogParentBlurb={catalogHeadlines.parentBlurb}
        selectedCategory={selectedCategory}
        selectedCategoryWizardProfile={selectedCategoryWizardProfile}
        setSelectedCategory={setSelectedCategory}
        where={where}
        setWhere={setWhere}
        guests={guests}
        setGuests={setGuests}
        guestsBreakdown={guestsBreakdown}
        setGuestsBreakdown={setGuestsBreakdown}
        clearDates={clearDates}
        nights={nights}
        extraFilters={extraFilters}
        onExtraFiltersChange={setExtraFilters}
        listingsForFiltersHistogram={allListings}
        priceHistogram={meta?.priceHistogram ?? null}
        filterResultCount={allListings.length}
        textQuery={searchQuery}
        setTextQuery={setSearchQuery}
        smartSearchOn={smartSearchOn}
        setSmartSearchOn={setSmartSearchOn}
        semanticSearchFeatureEnabled={semanticSiteEnabled}
        onSearchSubmit={handleCatalogSearchSubmit}
      />

      <div className="container mx-auto px-4 pt-4">
        <ReferralCatalogFunnelStrip language={language} />
      </div>

      <div className="container mx-auto px-4 py-4">
        <ForYouRail
          where={where}
          language={language}
          currency={currency}
          exchangeRates={exchangeRates}
          surface="for_you_catalog"
        />
      </div>

      <div id="listings-results" className="container mx-auto px-4 py-6">
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
              mobileMapSheet={isMobile}
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
              catalogCategories={catalogCategories}
              onListingPointerEnter={prefetchListingDetail}
              onListingPointerLeave={cancelListingDetailPrefetch}
              onListingCardSelect={handleListingCardSelect}
              catalogSort={catalogSort}
              onCatalogSortChange={handleCatalogSortChange}
              catalogSortDistanceAvailable={catalogSortDistanceAvailable}
            />
          </div>

          <SearchMapWrapper
            listings={allListings}
            searchKeyParams={searchKeyParams}
            appliedBbox={appliedBbox}
            userBookings={userBookings}
            userId={user?.id}
            language={language}
            currency={currency}
            exchangeRates={exchangeRates}
            initialDates={cardDates}
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

      <CatalogMobileMapSheet
        open={isMobile && showMap}
        onClose={() => setShowMap(false)}
        language={language}
        mapPanelProps={catalogMapPanelProps}
      />
    </div>
  )
}

export default function ListingsCatalogClient() {
  return (
    <Suspense
      fallback={<ListingsCatalogSkeleton />}
    >
      <ListingsContent />
    </Suspense>
  )
}
