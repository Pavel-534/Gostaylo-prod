'use client'

/**
 * GoStayLo - Search Results Page (client)
 * @see app/listings/page.js — серверная оболочка (metadata, ItemList JSON-LD)
 */

import { useState, useEffect, useMemo, useRef, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ListingsCatalogSkeleton } from '@/components/listings-catalog-skeleton'
import { format, differenceInDays } from 'date-fns'
import { useFxRatesQuery } from '@/lib/hooks/use-fx-rates-query'
import { FilterBar } from '@/components/search/FilterBar'
import { PublicSearchChrome } from '@/components/search/PublicSearchChrome'
import { UnifiedSearchBar } from '@/components/search/UnifiedSearchBar'
import { ListingSidebar } from '@/components/search/ListingSidebar'
import { SearchMapWrapper } from '@/components/search/SearchMapWrapper'
import { CatalogMobileMapSheet } from '@/components/search/CatalogMobileMapSheet'
import { CatalogMobileSearchSheet } from '@/components/search/CatalogMobileSearchSheet'
import { CatalogSearchSummaryBar } from '@/components/search/mobile/CatalogSearchSummaryBar'
import { MobileSearchFAB } from '@/components/search/mobile/MobileSearchFAB'
import { useIsMobile } from '@/hooks/use-mobile'
import { recordPwaEngagement } from '@/lib/pwa/pwa-install-storage.js'
import { deferPwaPrompt, resumePwaPrompt } from '@/lib/pwa/pwa-prompt-defer.js'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'
import { useIntersectionObserver, useListingsFetch } from '@/lib/hooks/useListingsSearch'
import { usePublicSearchFilters } from '@/lib/hooks/use-public-search-filters'
import { usePublicCategoriesQuery } from '@/lib/hooks/use-public-catalog-queries'
import { useListingDetailPrefetch } from '@/lib/hooks/use-listing-detail-prefetch'
import { detectLanguage, DEFAULT_UI_LANGUAGE, getUIText } from '@/lib/translations'
import { effectiveCategoryWizardProfileRaw } from '@/lib/config/category-hierarchy'
import { getCatalogSearchHeadlines } from '@/lib/search/catalog-search-headlines'
import { isCatalogTransportIntervalMode } from '@/lib/search/catalog-transport-interval'
import {
  parseBBoxFromParams,
  parseExtraFiltersFromParams,
  parseCatalogSortFromParams,
} from '@/lib/search/listings-page-url'
import { resolveCatalogSortCenter } from '@/lib/geo/catalog-sort-centers'
import { ReferralCatalogFunnelStrip } from '@/components/referral/ReferralCatalogFunnelStrip'
import { trackProductEvent, ProductAnalyticsEvents } from '@/lib/analytics/product-analytics.js'
import { ForYouRail } from '@/components/recommendations/ForYouRail'
import { useFavoritesBatch } from '@/hooks/use-favorites-batch'
import {
  CATALOG_MAP_SELECTION_PAN_HIGHLIGHT_ONLY,
  CATALOG_MAP_SELECTION_PAN_IF_OUT_OF_VIEW,
} from '@/lib/maps/catalog-map-ux-policy'
import { subscribeMobileSearchTabAction } from '@/lib/search/mobile-search-tab-action'
import { commitRecentSearchLocation } from '@/lib/search/commit-recent-search-location'
import { navigateWithListingHeroTransition } from '@/lib/navigation/listing-hero-transition'

const ITEMS_PER_PAGE = 12

function ListingsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useAuth()
  const isMobile = useIsMobile()

  const [language, setLanguage] = useState(DEFAULT_UI_LANGUAGE)
  const { data: catalogCategories = [] } = usePublicCategoriesQuery()
  const { prefetchListingDetail, cancelListingDetailPrefetch } = useListingDetailPrefetch()
  const [currency, setCurrency] = useState('THB')
  const { data: exchangeRates = { THB: 1 } } = useFxRatesQuery({ retail: true })
  const [showMap, setShowMap] = useState(false)
  const [userBookings, setUserBookings] = useState([])
  const [appliedBbox, setAppliedBbox] = useState(() => parseBBoxFromParams(searchParams))
  const [extraFilters, setExtraFilters] = useState(() => parseExtraFiltersFromParams(searchParams))
  const [mapSelectedListingId, setMapSelectedListingId] = useState(null)
  const [mapHoveredListingId, setMapHoveredListingId] = useState(null)
  const [catalogSort, setCatalogSort] = useState(() => parseCatalogSortFromParams(searchParams))
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

  const searchParamsKey = searchParams.toString()

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

  const urlCommitExtras = useMemo(
    () => ({ extraFilters, appliedBbox, catalogSort }),
    [extraFilters, appliedBbox, catalogSort],
  )

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
    guestsBreakdown,
    setGuestsBreakdown,
    searchQuery,
    setSearchQuery,
    smartSearchOn,
    setSmartSearchOn,
    semanticSiteEnabled,
    debouncedWhere,
    debouncedGuests,
    debouncedDateRange,
    debouncedSearchQuery,
    commitToUrl,
    markUrlPushSkipped,
    syncLastPushedQuery,
  } = usePublicSearchFilters({
    surface: 'catalog',
    categoriesFromApi: catalogCategories,
    wizardProfileBySlug,
    urlCommitExtras,
  })

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
      syncLastPushedQuery(incoming)
      setExtraFilters(parseExtraFiltersFromParams(searchParams))
      setAppliedBbox(parseBBoxFromParams(searchParams))
      markUrlPushSkipped()
      return
    }
    if (incoming === lastPushedSearchRef.current) return
    lastPushedSearchRef.current = incoming
    syncLastPushedQuery(incoming)
    setExtraFilters(parseExtraFiltersFromParams(searchParams))
    setAppliedBbox(parseBBoxFromParams(searchParams))
    setCatalogSort(parseCatalogSortFromParams(searchParams))
  }, [searchParamsKey, searchParams, syncLastPushedQuery, markUrlPushSkipped])

  useEffect(() => {
    if (!mapSelectedListingId) return
    if (isMobile && showMap) return
    const t = setTimeout(() => setMapSelectedListingId(null), 5000)
    return () => clearTimeout(t)
  }, [mapSelectedListingId, isMobile, showMap])

  const handleSearchThisArea = useCallback((b) => {
    setAppliedBbox(b)
  }, [])

  const handleClearMapBounds = useCallback(() => {
    setAppliedBbox(null)
  }, [])

  const handleListingMarkerClick = useCallback((id) => {
    setMapSelectedListingId(id)
    setMapHoveredListingId(null)
  }, [])

  const handleMapRailActiveChange = useCallback((id) => {
    setMapSelectedListingId(id)
    setMapHoveredListingId(null)
  }, [])

  const handleMapListingOpen = useCallback(
    (id) => {
      const listingId = String(id || '').trim()
      if (!listingId) return
      navigateWithListingHeroTransition(() => router.push(`/listings/${listingId}`), listingId)
    },
    [router],
  )

  const handleListingCardSelect = useCallback((id) => {
    setMapSelectedListingId(id)
    setMapHoveredListingId(null)
  }, [])

  const handleListingCardHover = useCallback((id) => {
    setMapHoveredListingId(id)
  }, [])

  const handleListingCardHoverEnd = useCallback((id) => {
    setMapHoveredListingId((prev) => (prev === id ? null : prev))
  }, [])

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
    hasMore,
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
    commitRecentSearchLocation({ where, language })
    commitToUrl()
    if (smartSearchOn && semanticSiteEnabled && searchQuery.trim().length >= 2) {
      setAiSearchPending(true)
    }
    commitSemanticSearch()
  }, [where, language, commitToUrl, smartSearchOn, semanticSiteEnabled, searchQuery, commitSemanticSearch])

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
      commitToUrl({ catalogSort: next, useDebounced: true })
    },
    [debouncedWhere, appliedBbox, commitToUrl],
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
    if (!isMobile) return undefined
    return subscribeMobileSearchTabAction(() => {
      setShowMap(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      setMobileSearchOpen(true)
    })
  }, [isMobile])

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
      hoveredListingId: mapHoveredListingId,
      onListingMarkerClick: handleListingMarkerClick,
      onSearchThisArea: handleSearchThisArea,
      mapBoundsLocked: !!appliedBbox,
      onClearMapBounds: handleClearMapBounds,
      appliedBboxKey,
      mapFitResetKey,
      selectionPanMode: isMobile && showMap
        ? CATALOG_MAP_SELECTION_PAN_HIGHLIGHT_ONLY
        : CATALOG_MAP_SELECTION_PAN_IF_OUT_OF_VIEW,
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
      mapHoveredListingId,
      handleListingMarkerClick,
      handleSearchThisArea,
      handleClearMapBounds,
      appliedBboxKey,
      mapFitResetKey,
      isMobile,
      showMap,
    ],
  )

  const catalogFilterBarProps = useMemo(
    () => ({
      filtersOpen,
      onFiltersOpenChange: setFiltersOpen,
      language,
      dateRange,
      setDateRange,
      checkInTime,
      setCheckInTime,
      checkOutTime,
      setCheckOutTime,
      categoriesForHierarchy: catalogCategories,
      catalogHeadline: catalogHeadlines.h1,
      catalogSubline: catalogHeadlines.sub,
      catalogParentBlurb: catalogHeadlines.parentBlurb,
      selectedCategory,
      selectedCategoryWizardProfile,
      setSelectedCategory,
      where,
      setWhere,
      guests,
      setGuests,
      guestsBreakdown,
      setGuestsBreakdown,
      clearDates,
      nights,
      extraFilters,
      onExtraFiltersChange: setExtraFilters,
      listingsForFiltersHistogram: allListings,
      priceHistogram: meta?.priceHistogram ?? null,
      filterResultCount: allListings.length,
      textQuery: searchQuery,
      setTextQuery: setSearchQuery,
      smartSearchOn,
      setSmartSearchOn,
      semanticSearchFeatureEnabled: semanticSiteEnabled,
      onSearchSubmit: handleCatalogSearchSubmit,
    }),
    [
      filtersOpen,
      language,
      dateRange,
      checkInTime,
      checkOutTime,
      catalogCategories,
      catalogHeadlines,
      selectedCategory,
      selectedCategoryWizardProfile,
      where,
      guests,
      guestsBreakdown,
      nights,
      extraFilters,
      allListings,
      meta?.priceHistogram,
      searchQuery,
      smartSearchOn,
      semanticSiteEnabled,
      handleCatalogSearchSubmit,
      setSelectedCategory,
      setWhere,
      setDateRange,
      setCheckInTime,
      setCheckOutTime,
      setGuests,
      setGuestsBreakdown,
      setExtraFilters,
      setSearchQuery,
      setSmartSearchOn,
    ],
  )

  const catalogMobileSearchActive =
    (selectedCategory && selectedCategory !== 'all') ||
    (where && where !== 'all') ||
    (guests && guests !== '1') ||
    Boolean(dateRange?.from) ||
    Boolean(searchQuery?.trim())

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicSearchChrome
        surface="catalog"
        expanded={
          <>
            <div className="md:hidden">
              <CatalogSearchSummaryBar
                language={language}
                category={selectedCategory}
                categoryWizardProfile={selectedCategoryWizardProfile}
                categoriesForHierarchy={catalogCategories}
                where={where}
                dateRange={dateRange}
                guests={guests}
                guestsBreakdown={guestsBreakdown}
                textQuery={searchQuery}
                catalogHeadline={catalogHeadlines.h1}
                catalogSubline={catalogHeadlines.sub}
                onOpenSearch={() => setMobileSearchOpen(true)}
              />
            </div>
            <div className="hidden md:block">
              <FilterBar shellWrapper={false} {...catalogFilterBarProps} />
            </div>
          </>
        }
        compact={
          <UnifiedSearchBar
            variant="compact"
            language={language}
            category={selectedCategory}
            where={where}
            setWhere={setWhere}
            dateRange={dateRange}
            setDateRange={setDateRange}
            guests={guests}
            setGuests={setGuests}
            guestsBreakdown={guestsBreakdown}
            setGuestsBreakdown={setGuestsBreakdown}
            onSearchSubmit={handleCatalogSearchSubmit}
            showFiltersButton
            onFiltersClick={() => setFiltersOpen(true)}
          />
        }
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
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
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
              highlightedListingId={mapHoveredListingId ?? mapSelectedListingId}
              scrollToListingId={mapSelectedListingId}
              catalogCategories={catalogCategories}
              onListingPointerEnter={prefetchListingDetail}
              onListingPointerLeave={cancelListingDetailPrefetch}
              onListingCardHover={handleListingCardHover}
              onListingCardHoverEnd={handleListingCardHoverEnd}
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
            hoveredListingId={mapHoveredListingId}
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
        railProps={{
          listings: allListings,
          activeListingId: mapSelectedListingId,
          onActiveListingChange: handleMapRailActiveChange,
          onListingOpen: handleMapListingOpen,
          language,
          currency,
          exchangeRates,
        }}
      />

      <MobileSearchFAB
        language={language}
        hidden={mobileSearchOpen || showMap}
        hasActiveFilters={catalogMobileSearchActive}
        onClick={() => setMobileSearchOpen(true)}
      />
      <CatalogMobileSearchSheet
        open={mobileSearchOpen}
        onClose={() => setMobileSearchOpen(false)}
        language={language}
        onSearchSubmit={handleCatalogSearchSubmit}
        filterBarProps={catalogFilterBarProps}
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
