'use client'

/**
 * Storefront catalog search results (client).
 * Stage 171.26 — TanStack hydrate from RSC bootstrap (`CatalogHydrationBoundary`).
 * Stage 200.114 — guest catalog rhythm polish (empty/skeleton/banner; no discovery API change).
 * Stage 201.96 — mobile-first mount: desktop FilterBar / compact search / Leaflet only after
 * `min-width` is confirmed; search + map sheets lazy-mount (CSS hide still hydrated them).
 * Stage 201.97 — catalog tree parked in storefront shell; frozen search params while hidden.
 * @see app/(storefront)/listings/page.js — server bootstrap + dehydrate
 */

import { useState, useEffect, useMemo, useRef, Suspense, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useFrozenCatalogSearchParams, useIsStorefrontCatalogListRoute } from '@/hooks/use-frozen-catalog-search-params'
import { ListingsCatalogSkeleton } from '@/components/listings-catalog-skeleton'
import { format, differenceInDays } from 'date-fns'
import { useFxRatesQuery } from '@/lib/hooks/use-fx-rates-query'
import { PublicSearchChrome } from '@/components/search/PublicSearchChrome'
import { ListingSidebar } from '@/components/search/ListingSidebar'
import { CatalogSearchSummaryBar } from '@/components/search/mobile/CatalogSearchSummaryBar'
import { MobileSearchFAB } from '@/components/search/mobile/MobileSearchFAB'
import { useIsMobile } from '@/hooks/use-mobile'
import { useMinWidthConfirmed, VIEWPORT_LG_MIN_PX, VIEWPORT_MD_MIN_PX } from '@/hooks/use-min-width'
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
  buildPublicSearchParams,
} from '@/lib/search/listings-page-url'
import {
  readCatalogMobileMapOpenFromLocation,
  writeCatalogMobileMapHash,
} from '@/lib/navigation/catalog-mobile-map-hash'
import {
  clearCatalogMapViewport,
  normalizeCatalogMapViewport,
  peekCatalogMapViewport,
} from '@/lib/navigation/catalog-map-viewport-memory'
import { bboxCenter } from '@/lib/geo/catalog-sort-centers'
import { useWhereGeoViewport } from '@/lib/hooks/use-where-geo-viewport'
import { ReferralCatalogFunnelStrip } from '@/components/referral/ReferralCatalogFunnelStrip'
import { trackProductEvent, ProductAnalyticsEvents } from '@/lib/analytics/product-analytics.js'
import dynamic from 'next/dynamic'
import { useFavoritesBatch } from '@/hooks/use-favorites-batch'
import {
  CATALOG_MAP_SELECTION_PAN_HIGHLIGHT_ONLY,
  CATALOG_MAP_SELECTION_PAN_IF_OUT_OF_VIEW,
} from '@/lib/maps/catalog-map-ux-policy'
import { subscribeMobileSearchTabAction } from '@/lib/search/mobile-search-tab-action'
import { commitRecentSearchLocation } from '@/lib/search/commit-recent-search-location'
import { navigateWithListingHeroTransition, prefetchListingPdp } from '@/lib/navigation/listing-hero-transition'

const ForYouRail = dynamic(
  () => import('@/components/recommendations/ForYouRail').then((m) => m.ForYouRail),
  { ssr: false, loading: () => null },
)
const CatalogMobileMapSheet = dynamic(
  () => import('@/components/search/CatalogMobileMapSheet').then((m) => m.CatalogMobileMapSheet),
  { ssr: false, loading: () => null },
)
const CatalogMobileSearchSheet = dynamic(
  () => import('@/components/search/CatalogMobileSearchSheet').then((m) => m.CatalogMobileSearchSheet),
  { ssr: false, loading: () => null },
)
const SearchMapWrapper = dynamic(
  () => import('@/components/search/SearchMapWrapper').then((m) => m.SearchMapWrapper),
  { ssr: false, loading: () => null },
)
const FilterBar = dynamic(
  () => import('@/components/search/FilterBar').then((m) => m.FilterBar),
  { ssr: false, loading: () => null },
)
const UnifiedSearchBar = dynamic(
  () => import('@/components/search/UnifiedSearchBar').then((m) => m.UnifiedSearchBar),
  { ssr: false, loading: () => null },
)

const ITEMS_PER_PAGE = 12

function ListingsContent() {
  const searchParams = useFrozenCatalogSearchParams()
  const isCatalogListRoute = useIsStorefrontCatalogListRoute()
  const router = useRouter()
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const isMdUp = useMinWidthConfirmed(VIEWPORT_MD_MIN_PX)
  const isLgUp = useMinWidthConfirmed(VIEWPORT_LG_MIN_PX)

  const [language, setLanguage] = useState(DEFAULT_UI_LANGUAGE)
  const { data: catalogCategories = [] } = usePublicCategoriesQuery()
  const { prefetchListingDetail, cancelListingDetailPrefetch } = useListingDetailPrefetch()
  const [currency, setCurrency] = useState('THB')
  const { data: exchangeRates = { THB: 1 } } = useFxRatesQuery({ retail: true })
  /** Stage 201.89 — soft-back camera from session even if App Router dropped `#map`. */
  const [softBackMapView, setSoftBackMapView] = useState(() => {
    if (typeof window === 'undefined') return null
    return normalizeCatalogMapViewport(peekCatalogMapViewport())
  })
  const [showMap, setShowMap] = useState(() => {
    if (typeof window === 'undefined') return false
    return (
      readCatalogMobileMapOpenFromLocation() ||
      Boolean(normalizeCatalogMapViewport(peekCatalogMapViewport()))
    )
  })
  const [userBookings, setUserBookings] = useState([])
  const [appliedBbox, setAppliedBbox] = useState(() => parseBBoxFromParams(searchParams))
  const [extraFilters, setExtraFilters] = useState(() => parseExtraFiltersFromParams(searchParams))
  /** Stage 201.81 / 201.84 / 201.89 — soft-back map camera (peek; React lock holds after restore). */
  const [cameraRestoreBbox, setCameraRestoreBbox] = useState(() => {
    if (!softBackMapView) return null
    return {
      south: softBackMapView.south,
      north: softBackMapView.north,
      west: softBackMapView.west,
      east: softBackMapView.east,
      centerLat: softBackMapView.centerLat,
      centerLng: softBackMapView.centerLng,
      zoom: softBackMapView.zoom,
    }
  })
  const [holdSoftBackCamera, setHoldSoftBackCamera] = useState(() => Boolean(softBackMapView))
  const holdSoftBackCameraRef = useRef(Boolean(softBackMapView))
  holdSoftBackCameraRef.current = holdSoftBackCamera
  const [mapSelectedListingId, setMapSelectedListingId] = useState(
    () => softBackMapView?.selectedListingId || null,
  )
  const [mapHoveredListingId, setMapHoveredListingId] = useState(null)
  const [catalogSort, setCatalogSort] = useState(() => parseCatalogSortFromParams(searchParams))
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [searchSheetReady, setSearchSheetReady] = useState(false)

  useEffect(() => {
    if (mobileSearchOpen) setSearchSheetReady(true)
  }, [mobileSearchOpen])

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
    filterSnapshot,
    transportSearchMode,
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
    searchParams,
    pathname: '/listings',
    urlSyncEnabled: isCatalogListRoute,
  })

  const whereGeoView = useWhereGeoViewport(debouncedWhere, language)

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

  const handleSearchThisArea = useCallback(
    (b) => {
      setAppliedBbox(b)
      commitToUrl({ appliedBbox: b, useDebounced: true })
    },
    [commitToUrl],
  )

  const handleClearMapBounds = useCallback(() => {
    setAppliedBbox(null)
    commitToUrl({ appliedBbox: null, useDebounced: true })
  }, [commitToUrl])

  const handleListingMarkerClick = useCallback(
    (id) => {
      const listingId = String(id || '').trim()
      if (!listingId) return
      setMapSelectedListingId(listingId)
      setMapHoveredListingId(null)
      prefetchListingPdp(router, listingId)
      prefetchListingDetail(listingId, { intent: 'touch' })
    },
    [prefetchListingDetail, router],
  )

  const handleMapBackgroundClick = useCallback(() => {
    setMapSelectedListingId(null)
    setMapHoveredListingId(null)
  }, [])

  const handleMapRailActiveChange = useCallback(
    (id) => {
      const listingId = String(id || '').trim()
      if (!listingId) return
      setMapSelectedListingId(listingId)
      setMapHoveredListingId(null)
      prefetchListingPdp(router, listingId)
      prefetchListingDetail(listingId, { intent: 'touch' })
    },
    [prefetchListingDetail, router],
  )

  const handleMapListingOpen = useCallback(
    (id) => {
      const listingId = String(id || '').trim()
      if (!listingId) return
      prefetchListingPdp(router, listingId)
      prefetchListingDetail(listingId, { intent: 'touch' })
      navigateWithListingHeroTransition(
        () => router.push(`/listings/${listingId}`),
        listingId,
        `/listings/${listingId}`,
      )
    },
    [prefetchListingDetail, router],
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
    whereSortCenter: whereGeoView.sortCenter,
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

  const catalogSortDistanceAvailable = useMemo(() => {
    if (appliedBbox && bboxCenter(appliedBbox)) return true
    return Boolean(whereGeoView.sortCenter)
  }, [appliedBbox, whereGeoView.sortCenter])

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
      writeCatalogMobileMapHash(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      setMobileSearchOpen(true)
    })
  }, [isMobile])

  // Hydrate map sheet from `#map` / soft-back viewport (Stage 201.89).
  // App Router often drops `#map` on replace — reopen from session + re-write hash.
  useEffect(() => {
    if (!isMobile) return undefined

    const hydrateSoftBackCamera = () => {
      const snap = normalizeCatalogMapViewport(peekCatalogMapViewport())
      if (!snap) return false
      setSoftBackMapView((prev) => prev || snap)
      setCameraRestoreBbox((prev) => {
        if (prev) return prev
        return {
          south: snap.south,
          north: snap.north,
          west: snap.west,
          east: snap.east,
          centerLat: snap.centerLat,
          centerLng: snap.centerLng,
          zoom: snap.zoom,
        }
      })
      setHoldSoftBackCamera(true)
      if (snap.selectedListingId) {
        setMapSelectedListingId((prev) => prev || snap.selectedListingId)
      }
      return true
    }

    const syncFromHash = () => {
      const hashOpen = readCatalogMobileMapOpenFromLocation()
      const hasViewport = Boolean(peekCatalogMapViewport())
      const open = hashOpen || hasViewport || holdSoftBackCameraRef.current
      if (open) {
        hydrateSoftBackCamera()
        if (!hashOpen) writeCatalogMobileMapHash(true)
      }
      setShowMap((prev) => {
        if (open) return prev === true ? prev : true
        // Do not close sheet while soft-back camera lock is held (viewport may already be consumed).
        if (holdSoftBackCameraRef.current) return prev
        return false
      })
    }

    syncFromHash()
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [isMobile])

  // One-shot: if we remounted with stored camera, force `#map` so sheet stays open.
  useEffect(() => {
    if (!isMobile) return
    if (!softBackMapView && !holdSoftBackCamera) return
    if (!readCatalogMobileMapOpenFromLocation()) {
      writeCatalogMobileMapHash(true)
    }
    setShowMap(true)
  }, [isMobile, softBackMapView, holdSoftBackCamera])

  // One-shot migration: legacy `?map=1` → `#map` (avoids catalog search remount storms).
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isCatalogListRoute) return
    if (searchParams.get('map') !== '1') return
    const sp = new URLSearchParams(searchParams.toString())
    sp.delete('map')
    const qs = sp.toString()
    lastPushedSearchRef.current = qs
    syncLastPushedQuery(qs)
    writeCatalogMobileMapHash(true)
    setShowMap(true)
    router.replace(`${window.location.pathname}${qs ? `?${qs}` : ''}#map`, { scroll: false })
  }, [searchParams, searchParamsKey, router, syncLastPushedQuery, isCatalogListRoute])

  const setMobileMapOpen = useCallback((open) => {
    const next = Boolean(open)
    setShowMap(next)
    writeCatalogMobileMapHash(next)
    if (!next) {
      clearCatalogMapViewport()
      setHoldSoftBackCamera(false)
      setCameraRestoreBbox(null)
      setSoftBackMapView(null)
    }
  }, [])

  const handleCameraRestoreDone = useCallback(() => {
    clearCatalogMapViewport()
    setCameraRestoreBbox(null)
    setHoldSoftBackCamera(true)
  }, [])

  const softBackMapCenter = useMemo(() => {
    const v = softBackMapView
    if (!v) return null
    if (!Number.isFinite(Number(v.centerLat)) || !Number.isFinite(Number(v.centerLng))) return null
    return [Number(v.centerLat), Number(v.centerLng)]
  }, [softBackMapView])

  const softBackMapZoom = useMemo(() => {
    const z = Number(softBackMapView?.zoom)
    return Number.isFinite(z) ? z : null
  }, [softBackMapView])

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
      hoveredListingId: mapSelectedListingId ? null : mapHoveredListingId,
      onListingMarkerClick: handleListingMarkerClick,
      onListingOpen: handleMapListingOpen,
      onMapBackgroundClick: handleMapBackgroundClick,
      onSearchThisArea: handleSearchThisArea,
      mapBoundsLocked: !!appliedBbox,
      onClearMapBounds: handleClearMapBounds,
      appliedBboxKey,
      mapFitResetKey,
      mapCenter: softBackMapCenter || whereGeoView.center,
      mapZoom: softBackMapZoom ?? whereGeoView.zoom,
      selectionPanMode: isMobile && showMap
        ? CATALOG_MAP_SELECTION_PAN_HIGHLIGHT_ONLY
        : CATALOG_MAP_SELECTION_PAN_IF_OUT_OF_VIEW,
      cameraRestoreBbox,
      onCameraRestoreDone: handleCameraRestoreDone,
      holdSoftBackCamera,
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
      handleMapListingOpen,
      handleMapBackgroundClick,
      handleSearchThisArea,
      handleClearMapBounds,
      appliedBboxKey,
      mapFitResetKey,
      whereGeoView.center,
      whereGeoView.zoom,
      softBackMapCenter,
      softBackMapZoom,
      isMobile,
      showMap,
      cameraRestoreBbox,
      handleCameraRestoreDone,
      holdSoftBackCamera,
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
      filterResultCount: Math.max(
        0,
        Math.round(Number(meta?.available ?? allListings.length) || 0),
      ),
      buildDraftSearchParams: (draftExtra) =>
        buildPublicSearchParams(filterSnapshot, {
          includeSemantic: true,
          semanticSiteEnabled,
          transportIntervalMode: transportSearchMode,
          extraFilters: draftExtra,
          appliedBbox,
          catalogSort,
        }),
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
      meta?.available,
      filterSnapshot,
      semanticSiteEnabled,
      transportSearchMode,
      appliedBbox,
      catalogSort,
      searchQuery,
      smartSearchOn,
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
            {isMdUp ? <FilterBar shellWrapper={false} {...catalogFilterBarProps} /> : null}
          </>
        }
        compact={
          isMdUp ? (
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
          ) : null
        }
      />

      {/* Stage 200.7 — no dead padding when referral / For You render null */}
      <ReferralCatalogFunnelStrip
        language={language}
        className="container mx-auto px-4 has-[>*]:pt-3 has-[>*]:pb-1"
      />

      <div className="container mx-auto hidden px-4 has-[>*]:block has-[>*]:py-3 md:has-[>*]:py-4">
        <ForYouRail
          where={where}
          language={language}
          currency={currency}
          exchangeRates={exchangeRates}
          surface="for_you_catalog"
        />
      </div>

      <div id="listings-results" className="container mx-auto px-4 pt-2 pb-6 md:py-6">
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
              onToggleMap={() => setMobileMapOpen(!showMap)}
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

          {isLgUp ? (
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
            hoveredListingId={mapSelectedListingId ? null : mapHoveredListingId}
            onListingMarkerClick={handleListingMarkerClick}
            onListingOpen={handleMapListingOpen}
            onMapBackgroundClick={handleMapBackgroundClick}
            onSearchThisArea={handleSearchThisArea}
            mapBoundsLocked={!!appliedBbox}
            onClearMapBounds={handleClearMapBounds}
            appliedBboxKey={appliedBboxKey}
            mapFitResetKey={mapFitResetKey}
            mapCenter={whereGeoView.center}
            mapZoom={whereGeoView.zoom}
          />
          ) : null}
        </div>
      </div>

      {showMap ? (
      <CatalogMobileMapSheet
        open={isMobile && showMap}
        onClose={() => setMobileMapOpen(false)}
        language={language}
        mapPanelProps={catalogMapPanelProps}
        railProps={{
          listings: allListings,
          activeListingId: mapSelectedListingId,
          onActiveListingChange: handleMapRailActiveChange,
          // Tap rail card → select pin + open map popup (PDP only via popup CTA).
          onListingOpen: handleMapRailActiveChange,
          language,
          currency,
          exchangeRates,
        }}
      />
      ) : null}

      <MobileSearchFAB
        language={language}
        hidden={mobileSearchOpen || showMap}
        hasActiveFilters={catalogMobileSearchActive}
        onClick={() => setMobileSearchOpen(true)}
      />
      {searchSheetReady ? (
      <CatalogMobileSearchSheet
        open={mobileSearchOpen}
        onClose={() => setMobileSearchOpen(false)}
        language={language}
        onSearchSubmit={handleCatalogSearchSubmit}
        filterBarProps={catalogFilterBarProps}
      />
      ) : null}
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
