'use client'

/**
 * PlatformHomeContent — домашняя страница: секции в `components/home/`, логика в `usePlatformHomePage`.
 */

import { useMemo, useEffect } from 'react'
import Link from 'next/link'
import { getUIText, getCategoryName } from '@/lib/translations'
import { getSiteDisplayName } from '@/lib/site-url'
import { usePlatformHomePage } from '@/hooks/home/use-platform-home-page'
import { HomeHeroLuxe } from '@/components/home/HomeHeroLuxe'
import { PublicSearchChrome } from '@/components/search/PublicSearchChrome'
import { UnifiedSearchBar } from '@/components/search/UnifiedSearchBar'
import { HowItWorks } from '@/components/home/HowItWorks'
import { TopListingsGrid } from '@/components/home/TopListingsGrid'
import { ForYouRail } from '@/components/recommendations/ForYouRail'
import { RecentlyViewedRail } from '@/components/recommendations/RecentlyViewedRail'
import { RECENTLY_VIEWED_MIN_HOME } from '@/lib/recommendations/constants'
import { useAuth } from '@/contexts/auth-context'
import { TrustBar } from '@/components/home/TrustBar'
import { PartnerCTA } from '@/components/home/PartnerCTA'
import { MobileSearchFAB } from '@/components/search/mobile/MobileSearchFAB'
import { CatalogMobileSearchSheet } from '@/components/search/CatalogMobileSearchSheet'
import { effectiveCategoryWizardProfileRaw } from '@/lib/config/category-hierarchy'
import { subscribeMobileSearchTabAction } from '@/lib/search/mobile-search-tab-action'
import { FooterSwitchers } from '@/components/FooterSwitchers'
import { ReferralVanityWelcomeHost } from '@/components/referral/ReferralVanityWelcomeBanner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function PlatformHomeContent() {
  const { user } = useAuth()
  const {
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
    selectedCategory,
    setSelectedCategory,
    where,
    setWhere,
    dateRange,
    checkInTime,
    setCheckInTime,
    checkOutTime,
    setCheckOutTime,
    setDateRange,
    nights,
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
    listings,
    exchangeRates,
    loading,
    listingsLoading,
    mobileSearchOpen,
    openMobileSearch,
    closeMobileSearch,
    mobileSearchFocusSection,
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
  } = usePlatformHomePage()

  const selectedCategoryWizardProfile = useMemo(() => {
    if (!selectedCategory || selectedCategory === 'all') return null
    return effectiveCategoryWizardProfileRaw(selectedCategory, categories)
  }, [selectedCategory, categories])

  const homeFilterBarProps = useMemo(
    () => ({
      language,
      dateRange,
      setDateRange: handleDateChange,
      checkInTime,
      setCheckInTime,
      checkOutTime,
      setCheckOutTime,
      categoriesForHierarchy: categories,
      selectedCategory,
      selectedCategoryWizardProfile,
      setSelectedCategory,
      where,
      setWhere,
      guests,
      setGuests,
      guestsBreakdown,
      setGuestsBreakdown,
      clearDates: () => setDateRange({ from: undefined, to: undefined }),
      nights,
      textQuery: searchQuery,
      setTextQuery: setSearchQuery,
      smartSearchOn,
      setSmartSearchOn,
      semanticSearchFeatureEnabled: semanticSiteEnabled,
      onSearchSubmit: handleSearch,
    }),
    [
      language,
      dateRange,
      handleDateChange,
      checkInTime,
      setCheckInTime,
      checkOutTime,
      setCheckOutTime,
      categories,
      selectedCategory,
      selectedCategoryWizardProfile,
      setSelectedCategory,
      where,
      setWhere,
      guests,
      setGuests,
      guestsBreakdown,
      setGuestsBreakdown,
      setDateRange,
      nights,
      searchQuery,
      setSearchQuery,
      smartSearchOn,
      setSmartSearchOn,
      semanticSiteEnabled,
      handleSearch,
    ],
  )

  const homeMobileSearchActive =
    (selectedCategory && selectedCategory !== 'all') ||
    (where && where !== 'all') ||
    (guests && guests !== '1') ||
    Boolean(dateRange?.from) ||
    String(searchQuery || '').trim().length >= 2

  useEffect(() => {
    return subscribeMobileSearchTabAction(() => {
      handleSearch()
    })
  }, [handleSearch])

  return (
    <div className="min-h-screen bg-white font-sans antialiased text-slate-900">
      <ReferralVanityWelcomeHost />
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
        onMobileFieldTap={openMobileSearch}
      />

      <div className="border-b border-brand/15 bg-gradient-to-r from-brand-muted/80 via-white to-brand-muted/80">
        <div className="gsl-page-container max-w-6xl py-2.5 flex flex-wrap items-center justify-center gap-2 text-center text-sm text-slate-700">
          <span>{getUIText('stage91_loyaltyHomeTeaser', language)}</span>
          <Link
            href="/about/loyalty"
            className="font-semibold text-brand underline decoration-brand/40 underline-offset-2 hover:text-brand-hover"
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
              variant="brand"
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

      {/* ADR-101 Wave 2 — compact search chrome (desktop); hero = expanded */}
      <PublicSearchChrome
        surface="home"
        compactTestId="sticky-search-bar"
        compact={
          <UnifiedSearchBar
            variant="compact"
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
            onSearchSubmit={handleHomeSearchSubmit}
          />
        }
      />

      <div className="gsl-page-container max-w-6xl space-y-8 py-8">
        <ForYouRail
          where={where}
          language={language}
          currency={currency}
          exchangeRates={exchangeRates}
          surface="for_you_home"
        />
        <RecentlyViewedRail
          surface="recent_home"
          userId={user?.id ?? null}
          language={language}
          currency={currency}
          exchangeRates={exchangeRates}
          minItems={RECENTLY_VIEWED_MIN_HOME}
        />
      </div>

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
        hasActiveFilters={homeMobileSearchActive}
        onClick={() => openMobileSearch()}
      />
      <CatalogMobileSearchSheet
        open={mobileSearchOpen}
        onClose={closeMobileSearch}
        language={language}
        onSearchSubmit={handleSearch}
        initialFocusSection={mobileSearchFocusSection}
        filterBarProps={homeFilterBarProps}
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
                      className="hover:text-brand/80 transition-colors"
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
                  <Link href="/about" className="hover:text-brand/80 transition-colors">
                    {getUIText('aboutUs', language)}
                  </Link>
                </li>
                <li>
                  <Link href="/help#contact" className="hover:text-brand/80 transition-colors">
                    {getUIText('contactUs', language)}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">{getUIText('footerSupport', language)}</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <Link href="/help/" className="hover:text-brand/80 transition-colors">
                    {getUIText('helpCenter', language)}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/help/escrow-protection"
                    className="hover:text-brand/80 transition-colors"
                  >
                    {getUIText('footerEscrowPaymentLink', language)}
                  </Link>
                </li>
                <li>
                  <a href={`mailto:${supportEmail}`} className="hover:text-brand/80 transition-colors">
                    {getUIText('contactUs', language)}
                  </a>
                </li>
                <li>
                  <Link href="/terms/" className="hover:text-brand/80 transition-colors">
                    {getUIText('terms', language)}
                  </Link>
                </li>
                <li>
                  <Link href="/legal/public-offer/" className="hover:text-brand/80 transition-colors">
                    {getUIText('footerPublicOffer', language)}
                  </Link>
                </li>
                <li>
                  <Link href="/legal/partner-terms/" className="hover:text-brand/80 transition-colors">
                    {getUIText('footerPartnerTerms', language)}
                  </Link>
                </li>
                <li>
                  <Link href="/legal/privacy/" className="hover:text-brand/80 transition-colors">
                    {getUIText('privacyPolicy', language)}
                  </Link>
                </li>
                <li>
                  <Link href="/legal/refund/" className="hover:text-brand/80 transition-colors">
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
