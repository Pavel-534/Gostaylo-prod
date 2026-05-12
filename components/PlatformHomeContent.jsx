'use client'

/**
 * PlatformHomeContent — домашняя страница: секции в `components/home/`, фильтры в `useHomeFilters`.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, isSameDay, differenceInDays } from 'date-fns'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { useI18n } from '@/contexts/i18n-context'
import { useCurrency } from '@/contexts/currency-context'
import { fetchCategories, fetchExchangeRates } from '@/lib/client-data'
import {
  getCategoryName,
  getUIText,
} from '@/lib/translations'
import { getSiteDisplayName } from '@/lib/site-url'
import { getPublicSupportEmail } from '@/lib/config/public-support-email'
import { LISTINGS_SEARCH_API_PATH } from '@/lib/search-endpoints'
import { isTransportIntervalWizardProfile } from '@/lib/config/category-wizard-profile-db'
import { hasCategoryParent } from '@/lib/config/category-hierarchy'
import { useHomeFilters } from '@/components/home/useHomeFilters'
import { HomeHeroLuxe } from '@/components/home/HomeHeroLuxe'
import { StickySearchBar } from '@/components/home/StickySearchBar'
import { HowItWorks } from '@/components/home/HowItWorks'
import { TopListingsGrid } from '@/components/home/TopListingsGrid'
import {
  AUTO_HERO_TITLE_FALLBACK,
  AUTO_TOP_LISTINGS_TITLE_FALLBACK,
  HOME_COPY_AUTO_TOKEN,
  getHomeHeroTitleRaw,
  getHomeTopListingsTitleRaw,
  resolveHomeCopy,
} from '@/lib/config/home-page-copy'
import { TrustBar } from '@/components/home/TrustBar'
import { PartnerCTA } from '@/components/home/PartnerCTA'
import { MobileSearchFAB, MobileSearchBottomSheet } from '@/components/search/MobileSearchBottomSheet'
import { FooterSwitchers } from '@/components/FooterSwitchers'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function PlatformHomeContent() {
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
      fetch('/api/v2/auth/me', { credentials: 'include' })
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.user) {
            localStorage.setItem('gostaylo_user', JSON.stringify(data.user))
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

        const response = await fetch(`/api/v2/search?${params.toString()}`)
        const data = await response.json()

        if (data.success) {
          setListings(data.data.listings)
          return data.data.meta.available
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


  useEffect(() => {
    fetchListingsData()
  }, [fetchListingsData])

  useEffect(() => {
    if (!loading) fetchListingsData(false)
  }, [debouncedDateRange, debouncedWhere, debouncedGuests, debouncedSearchQuery, loading, fetchListingsData])

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

        const response = await fetch(`${LISTINGS_SEARCH_API_PATH}?${params.toString()}`)
        const data = await response.json()
        if (data.success) setLiveCount(data.data.meta.available)
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
      const response = await fetch('/api/v2/leads/waiting-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          categorySlug,
          language,
          sourcePage: '/',
        }),
      })
      const data = await response.json()
      if (!response.ok || !data?.success) {
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
      if (newRange.from && newRange.to) {
        fetchLiveCount(newRange, where, guests, selectedCategory)
      }
    },
    [where, guests, selectedCategory, fetchLiveCount, setDateRange],
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

  return (
    <div className="min-h-screen bg-white font-sans antialiased">
      <HomeHeroLuxe
        language={language}
        categoryTabs={heroTabs}
        category={selectedCategory}
        setCategory={setSelectedCategory}
        where={where}
        setWhere={setWhere}
        dateRange={dateRange}
        setDateRange={handleDateChange}
        guests={guests}
        setGuests={setGuests}
        guestsBreakdown={guestsBreakdown}
        setGuestsBreakdown={setGuestsBreakdown}
        onSearch={handleSearch}
        textQuery={searchQuery}
        setTextQuery={setSearchQuery}
        smartSearchOn={smartSearchOn}
        setSmartSearchOn={setSmartSearchOn}
        semanticSearchFeatureEnabled={semanticSiteEnabled}
        onSearchSubmit={handleHomeSearchSubmit}
        liveCount={liveCount}
        countLoading={countLoading}
        heroTitle={heroTitle}
        onCategoryTabClick={handleCategoryTabClick}
      />

      <div className="border-b border-teal-100/80 bg-gradient-to-r from-teal-50/90 via-white to-teal-50/90">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2 px-4 py-2.5 text-center text-sm text-slate-700">
          <span>{getUIText('stage91_loyaltyHomeTeaser', language)}</span>
          <Link
            href="/about/loyalty"
            className="font-semibold text-[#006666] underline decoration-teal-600/50 underline-offset-2 hover:text-[#005757]"
          >
            {getUIText('stage91_loyaltyHomeCta', language)}
          </Link>
        </div>
      </div>

      <Dialog
        open={Boolean(comingSoonCategory)}
        onOpenChange={(open) => {
          if (!open) {
            setComingSoonCategory(null)
            setWaitingEmail('')
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {language === 'ru'
                ? 'Эта категория скоро будет доступна!'
                : 'This category is coming soon!'}
            </DialogTitle>
            <DialogDescription>
              {language === 'ru'
                ? 'Оставьте ваш email, чтобы узнать первым о запуске.'
                : 'Leave your email and be the first to know when it launches.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {comingSoonCategory?.slug ? (
              <p className="text-sm text-slate-600">
                {language === 'ru' ? 'Категория:' : 'Category:'}{' '}
                <span className="font-semibold">
                  {getCategoryName(
                    comingSoonCategory.slug,
                    language,
                    comingSoonCategory.name,
                  )}
                  {comingSoonCategory.isPreview && isAdminUser ? ' (preview)' : ''}
                </span>
              </p>
            ) : null}
            <Input
              type="email"
              value={waitingEmail}
              onChange={(e) => setWaitingEmail(e.target.value)}
              placeholder={language === 'ru' ? 'you@example.com' : 'you@example.com'}
              autoFocus
            />
            <Button
              onClick={submitComingSoonLead}
              disabled={waitingSubmitLoading || !String(waitingEmail || '').trim()}
              className="w-full"
            >
              {waitingSubmitLoading
                ? language === 'ru'
                  ? 'Отправка...'
                  : 'Submitting...'
                : language === 'ru'
                  ? 'Сообщить мне о запуске'
                  : 'Notify me on launch'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sticky search — появляется при скролле, поверх контента */}
      <StickySearchBar
        language={language}
        category={selectedCategory}
        where={where}
        setWhere={setWhere}
        dateRange={dateRange}
        setDateRange={handleDateChange}
        guests={guests}
        setGuests={setGuests}
        guestsBreakdown={guestsBreakdown}
        setGuestsBreakdown={setGuestsBreakdown}
        onSearch={handleSearch}
      />

      {/* Listings Grid — конверсия first, юзер видит объявления сразу под hero */}
      <TopListingsGrid
        language={language}
        dateRange={dateRange}
        guests={guests}
        checkInTime={checkInTime}
        checkOutTime={checkOutTime}
        listings={listings}
        loading={loading}
        listingsLoading={listingsLoading}
        aiGridPending={aiGridPending}
        exchangeRates={exchangeRates}
        currency={currency}
        mediaFallback={mediaFallback}
        markMediaFailed={markMediaFailed}
        onViewAll={handleSearch}
        customTitle={topListingsTitle}
      />

      {/* Partner CTA — после listings */}
      <PartnerCTA language={language} />

      {/* How It Works — контент-блок перемещён вниз (текст после воронки) */}
      <HowItWorks language={language} />

      {/* Trust Bar — social proof у footer'а */}
      <TrustBar language={language} locationContext={where || 'all'} />

      {/* Mobile Floating Search — FAB появляется на скролле, Bottom Sheet при нажатии */}
      <MobileSearchFAB
        language={language}
        hidden={mobileSearchOpen}
        hasActiveFilters={
          (selectedCategory && selectedCategory !== 'all') ||
          (where && where !== 'all') ||
          (guests && guests !== '1') ||
          Boolean(dateRange?.from)
        }
        onClick={() => setMobileSearchOpen(true)}
      />
      <MobileSearchBottomSheet
        open={mobileSearchOpen}
        onClose={() => setMobileSearchOpen(false)}
        language={language}
        categoryTabs={heroTabs}
        category={selectedCategory}
        setCategory={setSelectedCategory}
        onCategoryTabClick={handleCategoryTabClick}
        where={where}
        setWhere={setWhere}
        dateRange={dateRange}
        setDateRange={handleDateChange}
        guests={guests}
        setGuests={setGuests}
        onSearch={handleSearch}
      />

      <footer className="bg-slate-900 text-white py-10">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="col-span-2 md:col-span-1">
              <div className="mb-3">
                <span className="text-xl font-black tracking-tight text-white">{getSiteDisplayName()}</span>
              </div>
              <p className="text-slate-400 text-sm">{getUIText('footerDesc', language)}</p>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">{getUIText('footerCategories', language)}</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                {categories.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/listings?category=${c.slug}`}
                      className="hover:text-teal-400 transition-colors"
                    >
                      {getCategoryName(c.slug, language, c.name)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">{getUIText('footerCompany', language)}</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <Link href="/about" className="hover:text-teal-400 transition-colors">
                    {getUIText('aboutUs', language)}
                  </Link>
                </li>
                <li>
                  <Link href="/help#contact" className="hover:text-teal-400 transition-colors">
                    {getUIText('contactUs', language)}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">{getUIText('footerSupport', language)}</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <Link href="/help/" className="hover:text-teal-400 transition-colors">
                    {getUIText('helpCenter', language)}
                  </Link>
                </li>
                <li>
                  <a href={`mailto:${supportEmail}`} className="hover:text-teal-400 transition-colors">
                    {getUIText('contactUs', language)}
                  </a>
                </li>
                <li>
                  <Link href="/terms/" className="hover:text-teal-400 transition-colors">
                    {getUIText('terms', language)}
                  </Link>
                </li>
                <li>
                  <Link href="/legal/public-offer/" className="hover:text-teal-400 transition-colors">
                    {getUIText('footerPublicOffer', language)}
                  </Link>
                </li>
                <li>
                  <Link href="/legal/privacy/" className="hover:text-teal-400 transition-colors">
                    {getUIText('privacyPolicy', language)}
                  </Link>
                </li>
                <li>
                  <Link href="/legal/refund/" className="hover:text-teal-400 transition-colors">
                    {getUIText('footerRefundPolicy', language)}
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-sm text-slate-400">
            <p>
              © {new Date().getFullYear()} {getSiteDisplayName()}. {getUIText('allRightsReserved', language)}
            </p>
            <FooterSwitchers />
          </div>
        </div>
      </footer>
    </div>
  )
}
