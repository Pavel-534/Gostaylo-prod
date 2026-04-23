'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { isTransportListingCategory } from '@/lib/listing-category-slug'

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

/**
 * Home search filters: What / Where / When / Who, URL seed, smart search toggles.
 */
export function useHomeFilters() {
  const searchParams = useSearchParams()

  const [selectedCategory, setSelectedCategory] = useState('all')
  const [where, setWhere] = useState('all')
  const [dateRange, setDateRange] = useState({ from: null, to: null })
  const [checkInTime, setCheckInTime] = useState('07:00')
  const [checkOutTime, setCheckOutTime] = useState('07:00')
  const [guests, setGuests] = useState('2')
  const [searchQuery, setSearchQuery] = useState('')
  const [smartSearchOn, setSmartSearchOn] = useState(true)
  const [semanticSiteEnabled, setSemanticSiteEnabled] = useState(true)
  const pendingHomeSemanticRef = useRef(false)
  const [aiGridPending, setAiGridPending] = useState(false)

  const debouncedDateRange = useDebounce(dateRange, 500)
  const transportSearchMode = useMemo(
    () => isTransportListingCategory(selectedCategory),
    [selectedCategory],
  )
  const debouncedWhere = useDebounce(where, 300)
  const debouncedGuests = useDebounce(guests, 300)
  const debouncedSearchQuery = useDebounce(searchQuery, 400)

  // Seed from URL once on mount (back nav / shared link); avoid resetting on in-app param churn
  useEffect(() => {
    const cat = searchParams?.get('category')
    const w = searchParams?.get('where') || searchParams?.get('location') || searchParams?.get('city')
    const g = searchParams?.get('guests')
    const ci = searchParams?.get('checkIn')
    const co = searchParams?.get('checkOut')
    const ciTime = searchParams?.get('checkInTime')
    const coTime = searchParams?.get('checkOutTime')
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
      } catch {
        /* invalid dates */
      }
    }
    if (ciTime) setCheckInTime(ciTime)
    if (coTime) setCheckOutTime(coTime)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only initial URL → state, same as original home
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

  return {
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
  }
}
