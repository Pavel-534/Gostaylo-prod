'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { isTransportIntervalWizardProfile } from '@/lib/config/category-wizard-profile-db'
import { effectiveCategoryWizardProfileRaw } from '@/lib/config/category-hierarchy'
import { useDebounce } from '@/hooks/use-debounce'
import { fetchSiteFeatures } from '@/lib/api/catalog-public-client'

/**
 * Home search filters: What / Where / When / Who, URL seed, smart search toggles.
 * @param {Array<{ slug?: string, wizardProfile?: string | null }>} [categoriesFromApi] — для SSOT транспортного интервала
 */
export function useHomeFilters(categoriesFromApi = []) {
  const searchParams = useSearchParams()

  const [selectedCategory, setSelectedCategory] = useState('all')
  const [where, setWhere] = useState('all')
  const [dateRange, setDateRange] = useState({ from: null, to: null })
  const [checkInTime, setCheckInTime] = useState('07:00')
  const [checkOutTime, setCheckOutTime] = useState('07:00')
  const [guests, setGuests] = useState('1')
  const [guestsBreakdown, setGuestsBreakdown] = useState({ adults: 1, children: 0, infants: 0 })
  const [searchQuery, setSearchQuery] = useState('')
  const [smartSearchOn, setSmartSearchOn] = useState(true)
  const [semanticSiteEnabled, setSemanticSiteEnabled] = useState(true)
  const pendingHomeSemanticRef = useRef(false)
  const [aiGridPending, setAiGridPending] = useState(false)

  const debouncedDateRange = useDebounce(dateRange, 500)
  const transportSearchMode = useMemo(() => {
    const eff = effectiveCategoryWizardProfileRaw(selectedCategory, categoriesFromApi)
    return isTransportIntervalWizardProfile(eff, selectedCategory)
  }, [categoriesFromApi, selectedCategory])
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
    if (g) {
      const total = Math.max(1, parseInt(g, 10) || 1)
      setGuests(String(total))
      setGuestsBreakdown({ adults: total, children: 0, infants: 0 })
    }
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
    fetchSiteFeatures()
      .then(({ ok, semanticSearchOnSite }) => {
        if (ok && typeof semanticSearchOnSite === 'boolean') {
          setSemanticSiteEnabled(semanticSearchOnSite)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const total = Math.max(1, parseInt(guests, 10) || 1)
    const currentTotal =
      Math.max(1, parseInt(guestsBreakdown?.adults, 10) || 1) +
      Math.max(0, parseInt(guestsBreakdown?.children, 10) || 0) +
      Math.max(0, parseInt(guestsBreakdown?.infants, 10) || 0)
    if (currentTotal === total) return
    setGuestsBreakdown({ adults: total, children: 0, infants: 0 })
  }, [guests, guestsBreakdown])

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
    guestsBreakdown,
    setGuestsBreakdown,
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
