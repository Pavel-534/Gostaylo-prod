/**
 * Custom hooks for Listings Search functionality
 * Extracted to reduce main component size and improve reusability
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { format, isSameDay } from 'date-fns'
import { LISTINGS_SEARCH_API_PATH } from '@/lib/search-endpoints'
import { normalizeListingCategorySlugForSearch } from '@/lib/listing-category-slug'
import { appendExtraFiltersToParams, hasActiveExtraFilters } from '@/lib/search/listings-page-url'

const DEBOUNCE_DELAY = 300
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

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
// CACHE UTILITIES
// =========================================================

const searchCache = new Map()

function withBangkokTime(dateObj, hhmm = '07:00') {
  if (!dateObj) return null
  const d = format(dateObj, 'yyyy-MM-dd')
  const t = /^\d{2}:\d{2}$/.test(String(hhmm || '')) ? String(hhmm) : '07:00'
  return `${d}T${t}:00+07:00`
}

function getCacheKey(params) {
  return JSON.stringify(Object.fromEntries(params.entries()))
}

function getFromCache(key) {
  const cached = searchCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }
  searchCache.delete(key)
  return null
}

function setCache(key, data) {
  if (searchCache.size > 50) {
    const firstKey = searchCache.keys().next().value
    searchCache.delete(firstKey)
  }
  searchCache.set(key, { data, timestamp: Date.now() })
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
// LISTINGS FETCH HOOK
// =========================================================

function boundsParamsReady(bounds) {
  if (!bounds || typeof bounds !== 'object') return false
  const { south, north, west, east } = bounds
  return [south, north, west, east].every((n) => typeof n === 'number' && Number.isFinite(n))
}

export function useListingsFetch({
  selectedCategory,
  debouncedWhere,
  debouncedDateRange,
  debouncedGuests,
  checkInTime = '07:00',
  checkOutTime = '07:00',
  appliedMapBounds = null,
  extraFilters = null,
  debouncedTextQuery = '',
  /** Текущее значение поля поиска (без дебаунса) — для semantic при явном submit */
  liveTextQuery = '',
  smartSearchOn = false,
  semanticSiteEnabled = true,
  /** Первый запрос после захода с ?q=&semantic=1 — один раз с ИИ */
  initialSemanticFromUrl = false,
  itemsPerPage = 12,
}) {
  const [listings, setListings] = useState([])
  const [allListings, setAllListings] = useState([])
  const [displayedCount, setDisplayedCount] = useState(itemsPerPage)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [meta, setMeta] = useState(null)
  const [error, setError] = useState(null)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const requestIdRef = useRef(0)
  const pendingSemanticCommitRef = useRef(false)
  const isFirstFetchRef = useRef(true)
  const consumedUrlSemanticRef = useRef(false)

  const fetchListings = useCallback(
    async (isInitial = false) => {
      const currentRequestId = ++requestIdRef.current

      let useSemanticThisRequest = false
      if (pendingSemanticCommitRef.current && smartSearchOn && semanticSiteEnabled) {
        useSemanticThisRequest = true
        pendingSemanticCommitRef.current = false
      } else if (
        isFirstFetchRef.current &&
        initialSemanticFromUrl &&
        !consumedUrlSemanticRef.current &&
        smartSearchOn &&
        semanticSiteEnabled
      ) {
        useSemanticThisRequest = true
        consumedUrlSemanticRef.current = true
      }
      isFirstFetchRef.current = false

      const qt = useSemanticThisRequest
        ? String(liveTextQuery || '').trim()
        : String(debouncedTextQuery || '').trim()

      const params = new URLSearchParams()
      const categoryForApi = normalizeListingCategorySlugForSearch(selectedCategory)
      const intervalMode = categoryForApi === 'vehicles'
      if (categoryForApi && categoryForApi !== 'all') params.set('category', categoryForApi)
      if (debouncedWhere && debouncedWhere !== 'all') params.set('where', debouncedWhere)
      if (debouncedDateRange.from) {
        params.set(
          'checkIn',
          intervalMode
            ? withBangkokTime(debouncedDateRange.from, checkInTime)
            : format(debouncedDateRange.from, 'yyyy-MM-dd')
        )
      }
      if (
        debouncedDateRange.to &&
        (intervalMode || !isSameDay(debouncedDateRange.from, debouncedDateRange.to))
      ) {
        params.set(
          'checkOut',
          intervalMode
            ? withBangkokTime(debouncedDateRange.to, checkOutTime)
            : format(debouncedDateRange.to, 'yyyy-MM-dd')
        )
      }
      if (intervalMode && debouncedDateRange.from && debouncedDateRange.to) {
        params.set('checkInTime', checkInTime)
        params.set('checkOutTime', checkOutTime)
      }
      if (debouncedGuests) params.set('guests', debouncedGuests)
      if (qt.length >= 2) {
        params.set('q', qt)
        if (useSemanticThisRequest) params.set('semantic', '1')
      }
      if (boundsParamsReady(appliedMapBounds)) {
        params.set('south', String(appliedMapBounds.south))
        params.set('north', String(appliedMapBounds.north))
        params.set('west', String(appliedMapBounds.west))
        params.set('east', String(appliedMapBounds.east))
      }
      appendExtraFiltersToParams(params, extraFilters || {})
      params.set('limit', '100')

      const cacheKey = getCacheKey(params)

      const hasDates = debouncedDateRange.from && debouncedDateRange.to
      const hasBounds = boundsParamsReady(appliedMapBounds)
      const hasExtra = hasActiveExtraFilters(extraFilters)
      if (!hasDates && !hasBounds && !hasExtra) {
        const cached = getFromCache(cacheKey)
        if (cached) {
          if (currentRequestId !== requestIdRef.current) return

          setAllListings(cached.listings)
          setListings(cached.listings.slice(0, itemsPerPage))
          setDisplayedCount(itemsPerPage)
          setMeta(cached.meta)
          setLoading(false)
          setError(null)
          return
        }
      }

      if (!isInitial && listings.length > 0) {
        setIsTransitioning(true)
        await new Promise((r) => setTimeout(r, 150))
      }

      if (isInitial) setLoading(true)
      setError(null)

      try {
        const res = await fetch(`${LISTINGS_SEARCH_API_PATH}?${params.toString()}`)

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`)
        }

        const data = await res.json()

        if (currentRequestId !== requestIdRef.current) {
          return
        }

        if (data.success) {
          const newListings = data.data.listings || []

          if (!hasDates && !hasBounds && !hasExtra) {
            setCache(cacheKey, { listings: newListings, meta: data.data.meta })
          }

          setAllListings(newListings)
          setListings(newListings.slice(0, itemsPerPage))
          setDisplayedCount(itemsPerPage)
          setMeta(data.data.meta)
          setError(null)
        } else {
          throw new Error(data.error || 'Unknown error')
        }
      } catch (err) {
        console.error('[SEARCH] Error:', err)
        if (currentRequestId === requestIdRef.current) {
          setError(err.message)
          setListings([])
          setAllListings([])
        }
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setLoading(false)
          setIsTransitioning(false)
        }
      }
    },
    [
      selectedCategory,
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
      initialSemanticFromUrl,
      listings.length,
      itemsPerPage,
    ]
  )

  const commitSemanticSearch = useCallback(() => {
    pendingSemanticCommitRef.current = true
    fetchListings(false)
  }, [fetchListings])

  const loadMore = useCallback(() => {
    if (loadingMore || displayedCount >= allListings.length) return

    setLoadingMore(true)

    setTimeout(() => {
      const newCount = Math.min(displayedCount + itemsPerPage, allListings.length)
      setListings(allListings.slice(0, newCount))
      setDisplayedCount(newCount)
      setLoadingMore(false)
    }, 300)
  }, [loadingMore, displayedCount, allListings, itemsPerPage])

  const retry = useCallback(() => {
    setError(null)
    fetchListings(true)
  }, [fetchListings])

  return {
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
  }
}
