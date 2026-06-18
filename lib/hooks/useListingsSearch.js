/**
 * Custom hooks for Listings Search functionality
 * Stage 128.1 — каталог на TanStack Query (без module-level searchCache).
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { buildCatalogSearchKeyParams } from '@/lib/catalog/build-catalog-search-params'
import { fetchCatalogSearch } from '@/lib/catalog/fetch-catalog-search'

const DEBOUNCE_DELAY = 300
const SIMPLE_SEARCH_STALE_MS = 5 * 60 * 1000

// =========================================================
// DEBOUNCE HOOK
// =========================================================

export function useDebounce(value, delay = DEBOUNCE_DELAY) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}

// =========================================================
// INTERSECTION OBSERVER HOOK
// =========================================================

export function useIntersectionObserver(callback, options = {}) {
  const targetRef = useRef(null)

  useEffect(() => {
    const target = targetRef.current
    if (!target) return

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        callback()
      }
    }, { threshold: 0.1, ...options })

    observer.observe(target)
    return () => observer.disconnect()
  }, [callback, options])

  return targetRef
}

// =========================================================
// LISTINGS SEARCH (TanStack Query)
// =========================================================

export function useListingsFetch({
  selectedCategory,
  categoryWizardProfile = null,
  debouncedWhere,
  debouncedDateRange,
  debouncedGuests,
  checkInTime = '07:00',
  checkOutTime = '07:00',
  appliedMapBounds = null,
  extraFilters = null,
  debouncedTextQuery = '',
  liveTextQuery = '',
  smartSearchOn = false,
  semanticSiteEnabled = true,
  initialSemanticFromUrl = false,
  itemsPerPage = 12,
  /** Сегмент queryKey: смена валюты UI не ломает кэш поиска, но различает снимки при back-nav. */
  displayCurrency = 'THB',
}) {
  const [displayedCount, setDisplayedCount] = useState(itemsPerPage)
  const pendingSemanticCommitRef = useRef(false)
  const [semanticCommitTick, setSemanticCommitTick] = useState(0)
  const isFirstFetchRef = useRef(true)
  const consumedUrlSemanticRef = useRef(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const searchKeyParams = useMemo(() => {
    let useSemantic = false
    if (pendingSemanticCommitRef.current && smartSearchOn && semanticSiteEnabled) {
      useSemantic = true
      pendingSemanticCommitRef.current = false
    } else if (
      isFirstFetchRef.current &&
      initialSemanticFromUrl &&
      !consumedUrlSemanticRef.current &&
      smartSearchOn &&
      semanticSiteEnabled
    ) {
      useSemantic = true
      consumedUrlSemanticRef.current = true
    }
    if (isFirstFetchRef.current) {
      isFirstFetchRef.current = false
    }

    const textQuery = useSemantic
      ? String(liveTextQuery || '').trim()
      : String(debouncedTextQuery || '').trim()

    return buildCatalogSearchKeyParams({
      selectedCategory,
      categoryWizardProfile,
      debouncedWhere,
      debouncedDateRange,
      debouncedGuests,
      checkInTime,
      checkOutTime,
      appliedMapBounds,
      extraFilters,
      textQuery,
      useSemantic,
      limit: '100',
    })
  }, [
    selectedCategory,
    categoryWizardProfile,
    debouncedWhere,
    debouncedDateRange,
    debouncedGuests,
    checkInTime,
    checkOutTime,
    appliedMapBounds,
    extraFilters,
    debouncedTextQuery,
    liveTextQuery,
    smartSearchOn,
    semanticSiteEnabled,
    semanticCommitTick,
    displayCurrency,
  ])

  const isSimpleSearch = !searchKeyParams._flags?.hasDates &&
    !searchKeyParams._flags?.hasBounds &&
    !searchKeyParams._flags?.hasExtra

  const query = useQuery({
    queryKey: queryKeys.catalog.search({
      ...searchKeyParams,
      displayCurrency: String(displayCurrency || 'THB').toUpperCase(),
    }),
    queryFn: () => fetchCatalogSearch(searchKeyParams),
    placeholderData: keepPreviousData,
    staleTime: isSimpleSearch ? SIMPLE_SEARCH_STALE_MS : 0,
    gcTime: 30 * 60 * 1000,
  })

  const allListings = query.data?.listings ?? []
  const meta = query.data?.meta ?? null

  useEffect(() => {
    setDisplayedCount(itemsPerPage)
  }, [query.dataUpdatedAt, itemsPerPage])

  const listings = useMemo(
    () => allListings.slice(0, displayedCount),
    [allListings, displayedCount],
  )

  const loading = query.isPending && !query.isPlaceholderData
  const isTransitioning = query.isFetching && !query.isPending

  const commitSemanticSearch = useCallback(() => {
    pendingSemanticCommitRef.current = true
    setSemanticCommitTick((t) => t + 1)
  }, [])

  const loadMore = useCallback(() => {
    if (loadingMore || displayedCount >= allListings.length) return
    setLoadingMore(true)
    setTimeout(() => {
      setDisplayedCount((prev) => Math.min(prev + itemsPerPage, allListings.length))
      setLoadingMore(false)
    }, 300)
  }, [loadingMore, displayedCount, allListings.length, itemsPerPage])

  const retry = useCallback(() => {
    void query.refetch()
  }, [query])

  const fetchListings = useCallback(() => {
    void query.refetch()
  }, [query])

  return {
    listings,
    allListings,
    displayedCount,
    loading,
    loadingMore,
    meta,
    error: query.error?.message ?? null,
    isTransitioning,
    searchKeyParams,
    fetchListings,
    commitSemanticSearch,
    loadMore,
    retry,
  }
}
