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
  appliedMapBounds = null,
  extraFilters = null,
  debouncedTextQuery = '',
  useSemanticBlend = false,
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

  const fetchListings = useCallback(
    async (isInitial = false) => {
      const currentRequestId = ++requestIdRef.current

      const params = new URLSearchParams()
      const categoryForApi = normalizeListingCategorySlugForSearch(selectedCategory)
      if (categoryForApi && categoryForApi !== 'all') params.set('category', categoryForApi)
      if (debouncedWhere && debouncedWhere !== 'all') params.set('where', debouncedWhere)
      if (debouncedDateRange.from) params.set('checkIn', format(debouncedDateRange.from, 'yyyy-MM-dd'))
      if (debouncedDateRange.to && !isSameDay(debouncedDateRange.from, debouncedDateRange.to)) {
        params.set('checkOut', format(debouncedDateRange.to, 'yyyy-MM-dd'))
      }
      if (debouncedGuests) params.set('guests', debouncedGuests)
      const qt = String(debouncedTextQuery || '').trim()
      if (qt.length >= 2) {
        params.set('q', qt)
        if (useSemanticBlend) params.set('semantic', '1')
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
      appliedMapBounds,
      extraFilters,
      debouncedTextQuery,
      useSemanticBlend,
      listings.length,
      itemsPerPage,
    ]
  )

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
    loadMore,
    retry,
  }
}
