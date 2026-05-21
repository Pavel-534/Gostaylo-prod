'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, isSameDay, differenceInDays } from 'date-fns'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { useI18n } from '@/contexts/i18n-context'
import { useCurrency } from '@/contexts/currency-context'
import { fetchCategories, fetchExchangeRates, FX_RATES_UPDATED_EVENT } from '@/lib/client-data'
import { fetchAuthMe } from '@/lib/api/auth-client'
import {
  fetchHomeFeaturedSearch,
  fetchHomeListingsAvailableCount,
  submitHomeWaitingListLead,
} from '@/lib/home/platform-home-api-client'
import { getUIText } from '@/lib/translations'
import { getPublicSupportEmail } from '@/lib/config/public-support-email'
import { isTransportIntervalWizardProfile } from '@/lib/config/category-wizard-profile-db'
import { hasCategoryParent } from '@/lib/config/category-hierarchy'
import { useHomeFilters } from '@/components/home/useHomeFilters'
import {
  AUTO_HERO_TITLE_FALLBACK,
  AUTO_TOP_LISTINGS_TITLE_FALLBACK,
  HOME_COPY_AUTO_TOKEN,
  getHomeHeroTitleRaw,
  getHomeTopListingsTitleRaw,
  resolveHomeCopy,
} from '@/lib/config/home-page-copy'

/** Stage 111.1 — логика главной страницы (без разметки). */
export function usePlatformHomePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user: authUser, openLoginModal } = useAuth()

  // SSOT: язык из I18nProvider, валюта из CurrencyProvider
  const { language } = useI18n()
  const { currency } = useCurrency()
  const supportEmail = getPublicSupportEmail()

  const [categories, setCategories] = useState([])
  const isAdminUser = String(authUser?.role || '').toUpperCase() === 'ADMIN'
  const [comingSoonCategory, setComingSoonCategory] = useState(null)
  const [waitingEmail, setWaitingEmail] = useState('')
  const [waitingSubmitLoading, setWaitingSubmitLoading] = useState(false)

  const filters = useHomeFilters(categories)
  const {
    selectedCategory,
    setSelectedCategory,
    where,
    setWhere,
    dateRange,
    setDateRange,
    checkInTime,
    checkOutTime,
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
  } = filters
  const selectedCategoryRow = useMemo(
    () => categories.find((c) => String(c?.slug) === String(selectedCategory || '')),
    [categories, selectedCategory],
  )

  const [listings, setListings] = useState([])
  const [exchangeRates, setExchangeRates] = useState({})
  const [loading, setLoading] = useState(true)
  const [listingsLoading, setListingsLoading] = useState(false)

  // Mobile floating search sheet
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

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
      fetchAuthMe().then(({ ok, user }) => {
          if (ok && user) {
            localStorage.setItem('gostaylo_user', JSON.stringify(user))
          }
        })
    }
    if (searchParams?.get('auth_error')) {
      toast.error(language === 'ru' ? 'Ошибка авторизации' : 'Auth error')
      window.history.replaceState({}, '', '/')
    }
  }, [searchParams, language, openLoginModal])

  useEffect(() => {
    Promise.all([fetchCategories(), fetchExchangeRates()])
      .then(([cats, rates]) => {
        setCategories(cats)
        setExchangeRates(rates)
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    const onFxUpdated = (e) => {
      if (e?.detail && typeof e.detail === 'object') setExchangeRates(e.detail)
    }
    window.addEventListener(FX_RATES_UPDATED_EVENT, onFxUpdated)
    return () => window.removeEventListener(FX_RATES_UPDATED_EVENT, onFxUpdated)
  }, [])

  // Свежие курсы при возврате на вкладку (Ctrl+F5 не чистит localStorage — фоновая revalidate + force).
  useEffect(() => {
    const refreshRates = () => {
      fetchExchangeRates({ force: true })
        .then(setExchangeRates)
        .catch(console.error)
    }
    const onVis = () => {
      if (document.visibilityState === 'visible') refreshRates()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const fetchListingsData = useCallback(
    async (showLoading = true) => {
      if (selectedCategoryRow?.isComingSoon === true) {
        setListings([])
        setLoading(false)
        setListingsLoading(false)
        return 0
      }
      if (showLoading) setListingsLoading(true)

      try {
        const params = new URLSearchParams({ limit: '12', featured: 'true' })
        params.set('softAvailability', '0')
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

        const { ok, listings: rows, available } = await fetchHomeFeaturedSearch(params)
        if (ok) {
          setListings(rows)
          return available
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
      pendingHomeSemanticRef,
      selectedCategoryRow?.isComingSoon,
    ],
  )
  const handleHomeSearchSubmit = useCallback(() => {
    if (selectedCategoryRow?.isComingSoon === true) {
      setComingSoonCategory(selectedCategoryRow)
      return
    }
    if (smartSearchOn && semanticSiteEnabled && searchQuery.trim().length >= 2) {
      setAiGridPending(true)
    }
    pendingHomeSemanticRef.current = true
    fetchListingsData(false)
  }, [
    smartSearchOn,
    semanticSiteEnabled,
    searchQuery,
    fetchListingsData,
    setAiGridPending,
    pendingHomeSemanticRef,
    selectedCategoryRow,
  ])


  const skipDebouncedListingsRef = useRef(true)

  useEffect(() => {
    fetchListingsData()
  }, [fetchListingsData])

  useEffect(() => {
    if (skipDebouncedListingsRef.current) {
      skipDebouncedListingsRef.current = false
      return
    }
    fetchListingsData(false)
  }, [debouncedDateRange, debouncedWhere, debouncedGuests, debouncedSearchQuery, fetchListingsData])

  const fetchLiveCount = useCallback(
    async (dr, w, g, cat) => {
      setCountLoading(true)
      try {
        const params = new URLSearchParams({ limit: '50' })
        params.set('softAvailability', '0')
        if (cat && cat !== 'all') params.set('category', cat)
        if (w && w !== 'all') params.set('where', w)
        if (dr?.from && dr?.to && !isSameDay(dr.from, dr.to)) {
          params.set('checkIn', format(dr.from, 'yyyy-MM-dd'))
          params.set('checkOut', format(dr.to, 'yyyy-MM-dd'))
          const wpRow = categories.find((c) => String(c.slug) === String(cat))
          if (isTransportIntervalWizardProfile(wpRow?.wizardProfile ?? wpRow?.wizard_profile, cat)) {
            params.set('checkInTime', checkInTime)
            params.set('checkOutTime', checkOutTime)
          }
        }
        if (g && g !== '1') params.set('guests', g)
        const qt = (searchQuery || '').trim()
        if (qt.length >= 2) params.set('q', qt)

        const { ok, available } = await fetchHomeListingsAvailableCount(params)
        if (ok) setLiveCount(available)
      } catch (e) {
        console.error('Live count error:', e)
      } finally {
        setCountLoading(false)
      }
    },
    [searchQuery, checkInTime, checkOutTime, categories],
  )

  const handleSearch = useCallback(() => {
    if (selectedCategoryRow?.isComingSoon === true) {
      setComingSoonCategory(selectedCategoryRow)
      return
    }
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
    selectedCategoryRow,
  ])

  const handleCategoryTabClick = useCallback(
    (tab) => {
      if (!tab?.slug) return
      if (tab.isComingSoon === true) {
        setComingSoonCategory(tab)
        return
      }
      setSelectedCategory(tab.slug)
    },
    [setSelectedCategory],
  )

  const submitComingSoonLead = useCallback(async () => {
    const email = String(waitingEmail || '').trim().toLowerCase()
    const categorySlug = String(comingSoonCategory?.slug || '').trim().toLowerCase()
    if (!email || !categorySlug) return
    setWaitingSubmitLoading(true)
    try {
      const { ok } = await submitHomeWaitingListLead({
        email,
        categorySlug,
        language,
        sourcePage: '/',
      })
      if (!ok) {
        toast.error(language === 'ru' ? 'Не удалось сохранить email' : 'Failed to save email')
        return
      }
      toast.success(
        language === 'ru'
          ? 'Спасибо! Сообщим, когда категория откроется.'
          : 'Thanks! We will notify you when this category launches.',
      )
      setComingSoonCategory(null)
      setWaitingEmail('')
    } catch {
      toast.error(language === 'ru' ? 'Сетевая ошибка' : 'Network error')
    } finally {
      setWaitingSubmitLoading(false)
    }
  }, [waitingEmail, comingSoonCategory, language])

  useEffect(() => {
    if (!listingsLoading) setAiGridPending(false)
  }, [listingsLoading, setAiGridPending])

  const handleDateChange = useCallback(
    (newRange) => {
      setDateRange(newRange)
    },
    [setDateRange],
  )

  useEffect(() => {
    if (dateRange.from && dateRange.to) {
      fetchLiveCount(dateRange, where, guests, selectedCategory)
    }
  }, [debouncedSearchQuery, dateRange, where, guests, selectedCategory, fetchLiveCount])

  const nights = useMemo(
    () => (dateRange.from && dateRange.to ? differenceInDays(dateRange.to, dateRange.from) : 0),
    [dateRange],
  )

  const categoryBarRoots = useMemo(() => {
    return [...(categories || [])]
      .filter((c) => c && c.slug && !hasCategoryParent(c))
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
  }, [categories])

  const heroTabs = useMemo(() => {
    const preferred = ['property', 'vehicles', 'yachts', 'tours']
    const picked = preferred
      .map((slug) => categoryBarRoots.find((c) => c.slug === slug))
      .filter(Boolean)
    if (picked.length >= 3) return picked
    return categoryBarRoots.slice(0, 4)
  }, [categoryBarRoots])

  // SSOT: white-label копии главной берутся из env (NEXT_PUBLIC_HOME_*) — `lib/config/home-page-copy.js`.
  // `'AUTO'` → локализованная строка через `getUIText(key, language)` (меняется при переключении языка).
  const heroTitle = useMemo(() => {
    const raw = getHomeHeroTitleRaw()
    const resolved = resolveHomeCopy(
      raw,
      (k) => getUIText(k, language),
      'heroTitle',
      AUTO_HERO_TITLE_FALLBACK,
    )
    if (raw === HOME_COPY_AUTO_TOKEN) {
      const t = typeof resolved === 'string' ? resolved.trim() : ''
      return t.length > 0 ? resolved.trim() : AUTO_HERO_TITLE_FALLBACK
    }
    const finalTitle = typeof resolved === 'string' ? resolved.trim() : ''
    return finalTitle.length > 0 ? finalTitle : 'Легкая и удобная аренда по всему миру'
  }, [language])
  const topListingsTitle = useMemo(() => {
    const raw = getHomeTopListingsTitleRaw()
    const resolved = resolveHomeCopy(
      raw,
      (k) => getUIText(k, language),
      'topListingsTitle',
      AUTO_TOP_LISTINGS_TITLE_FALLBACK,
    )
    if (raw === HOME_COPY_AUTO_TOKEN) {
      const t = typeof resolved === 'string' ? resolved.trim() : ''
      return t.length > 0 ? resolved.trim() : AUTO_TOP_LISTINGS_TITLE_FALLBACK
    }
    return resolved
  }, [language])

  return {
    router,
    language,
    currency,
    supportEmail,
    categories,
    isAdminUser,
    comingSoonCategory,
    setComingSoonCategory,
    waitingEmail,
    setWaitingEmail,
    waitingSubmitLoading,
    filters,
    selectedCategory,
    setSelectedCategory,
    where,
    setWhere,
    dateRange,
    checkInTime,
    checkOutTime,
    guests,
    setGuests,
    guestsBreakdown,
    setGuestsBreakdown,
    searchQuery,
    setSearchQuery,
    smartSearchOn,
    setSmartSearchOn,
    semanticSiteEnabled,
    transportSearchMode,
    selectedCategoryRow,
    listings,
    exchangeRates,
    loading,
    listingsLoading,
    mobileSearchOpen,
    setMobileSearchOpen,
    liveCount,
    countLoading,
    mediaFallback,
    markMediaFailed,
    aiGridPending,
    handleHomeSearchSubmit,
    handleSearch,
    handleCategoryTabClick,
    submitComingSoonLead,
    handleDateChange,
    heroTabs,
    heroTitle,
    topListingsTitle,
    nights,
  }
}
