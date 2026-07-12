'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, differenceInDays } from 'date-fns'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { useI18n } from '@/contexts/i18n-context'
import { useCurrency } from '@/contexts/currency-context'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { usePublicCategoriesQuery } from '@/lib/hooks/use-public-catalog-queries'
import { useHomeLiveCountQuery } from '@/lib/hooks/use-home-live-count-query'
import { useFxRatesQuery } from '@/lib/hooks/use-fx-rates-query'
import { fetchAuthMe } from '@/lib/api/auth-client'
import { submitHomeWaitingListLead } from '@/lib/home/platform-home-api-client'
import { commitRecentSearchLocation } from '@/lib/search/commit-recent-search-location'
import { buildHomeFeaturedKeyParams, fetchHomeFeatured } from '@/lib/home/fetch-home-featured'
import { queryKeys } from '@/lib/query-keys'
import { getUIText } from '@/lib/translations'
import { getPublicSupportEmail } from '@/lib/config/public-support-email'
import { hasCategoryParent } from '@/lib/config/category-hierarchy'
import { usePublicSearchFilters } from '@/lib/hooks/use-public-search-filters'
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

  const categoriesQuery = usePublicCategoriesQuery()
  const { data: categories = [] } = categoriesQuery
  const isAdminUser = String(authUser?.role || '').toUpperCase() === 'ADMIN'
  const [comingSoonCategory, setComingSoonCategory] = useState(null)
  const [waitingEmail, setWaitingEmail] = useState('')
  const [waitingSubmitLoading, setWaitingSubmitLoading] = useState(false)

  const filters = usePublicSearchFilters({ surface: 'home', categoriesFromApi: categories })
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
    pendingHomeSemanticRef,
    aiGridPending,
    setAiGridPending,
    debouncedDateRange,
    debouncedWhere,
    debouncedGuests,
    debouncedSearchQuery,
    transportSearchMode,
    navigateToCatalog,
  } = filters
  const selectedCategoryRow = useMemo(
    () => categories.find((c) => String(c?.slug) === String(selectedCategory || '')),
    [categories, selectedCategory],
  )

  const { data: exchangeRates = { THB: 1 } } = useFxRatesQuery({ retail: true })
  const [semanticCommitTick, setSemanticCommitTick] = useState(0)
  const featuredEnabled = selectedCategoryRow?.isComingSoon !== true

  const featuredKeyParams = useMemo(() => {
    let useSemantic = false
    if (pendingHomeSemanticRef.current && semanticSiteEnabled && smartSearchOn) {
      useSemantic = true
      pendingHomeSemanticRef.current = false
    }
    const textQuery = useSemantic
      ? String(searchQuery || '').trim()
      : String(debouncedSearchQuery || '').trim()
    return buildHomeFeaturedKeyParams({
      selectedCategory,
      where: debouncedWhere,
      dateRange: debouncedDateRange,
      guests: debouncedGuests,
      checkInTime,
      checkOutTime,
      transportSearchMode,
      textQuery,
      useSemantic,
    })
  }, [
    selectedCategory,
    debouncedWhere,
    debouncedDateRange,
    debouncedGuests,
    checkInTime,
    checkOutTime,
    transportSearchMode,
    debouncedSearchQuery,
    searchQuery,
    smartSearchOn,
    semanticSiteEnabled,
    semanticCommitTick,
    pendingHomeSemanticRef,
  ])

  const featuredQuery = useQuery({
    queryKey: queryKeys.home.featured(featuredKeyParams),
    queryFn: () => fetchHomeFeatured(featuredKeyParams),
    enabled: featuredEnabled,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })

  const listings = featuredEnabled ? (featuredQuery.data?.listings ?? []) : []
  const listingsLoading =
    featuredEnabled && featuredQuery.isFetching && !featuredQuery.isPending
  const loading =
    categoriesQuery.isPending ||
    (featuredEnabled && featuredQuery.isPending && !featuredQuery.isPlaceholderData)

  // Mobile unified search sheet (Stage 178.7 / 179.0 overview-only)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

  const openMobileSearch = useCallback(() => {
    setMobileSearchOpen(true)
  }, [])

  const closeMobileSearch = useCallback(() => {
    setMobileSearchOpen(false)
  }, [])

  const liveCountQuery = useHomeLiveCountQuery({
    dateRange,
    where,
    guests,
    selectedCategory,
    searchQuery,
    checkInTime,
    checkOutTime,
    categories,
    displayCurrency: currency,
  })
  const liveCount = liveCountQuery.data ?? null
  const countLoading = liveCountQuery.isFetching

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

  const handleHomeSearchSubmit = useCallback(() => {
    if (selectedCategoryRow?.isComingSoon === true) {
      setComingSoonCategory(selectedCategoryRow)
      return
    }
    commitRecentSearchLocation({ where, language })
    if (smartSearchOn && semanticSiteEnabled && searchQuery.trim().length >= 2) {
      setAiGridPending(true)
    }
    pendingHomeSemanticRef.current = true
    setSemanticCommitTick((t) => t + 1)
  }, [
    where,
    language,
    smartSearchOn,
    semanticSiteEnabled,
    searchQuery,
    setAiGridPending,
    pendingHomeSemanticRef,
    selectedCategoryRow,
  ])

  const handleSearch = useCallback(() => {
    if (selectedCategoryRow?.isComingSoon === true) {
      setComingSoonCategory(selectedCategoryRow)
      return
    }
    commitRecentSearchLocation({ where, language })
    navigateToCatalog()
  }, [navigateToCatalog, selectedCategoryRow, where, language])

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
  // Пустой env → режим AUTO: `homeHeroHeadline` через `getUIText(key, language)`.
  const heroTitle = useMemo(() => {
    const raw = getHomeHeroTitleRaw() ?? HOME_COPY_AUTO_TOKEN
    const resolved = resolveHomeCopy(
      raw,
      (k) => getUIText(k, language),
      'homeHeroHeadline',
      AUTO_HERO_TITLE_FALLBACK,
    )
    if (raw === HOME_COPY_AUTO_TOKEN) {
      const t = typeof resolved === 'string' ? resolved.trim() : ''
      return t.length > 0 ? resolved.trim() : AUTO_HERO_TITLE_FALLBACK
    }
    const finalTitle = typeof resolved === 'string' ? resolved.trim() : ''
    return finalTitle.length > 0 ? finalTitle : AUTO_HERO_TITLE_FALLBACK
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
    transportSearchMode,
    selectedCategoryRow,
    listings,
    exchangeRates,
    loading,
    listingsLoading,
    mobileSearchOpen,
    openMobileSearch,
    closeMobileSearch,
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
