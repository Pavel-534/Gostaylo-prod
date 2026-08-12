'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { durationPhraseForBookingEmail } from '@/lib/email/booking-email-i18n'
import { ru, enUS, zhCN, th as thLocale } from 'date-fns/locale'
import {
  Calendar, DollarSign, Users, Home,
  Check, ChevronRight, UserCheck, UserMinus,
  CalendarDays, Bell, AlertCircle,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PartnerHostLedgerAmount } from '@/components/partner/finances/partner-host-amount-display'
import { cn } from '@/lib/utils'
import { getUIText } from '@/lib/translations'
import { brandMintHex } from '@/lib/theme/tokens'
import PartnerHostVerificationBanner from '@/components/partner/PartnerHostVerificationBanner'
import { PartnerVerifiedBadgePromo } from '@/components/partner/PartnerVerifiedBadgePromo'
import { PartnerOnboardingChecklist } from '@/components/partner/PartnerOnboardingChecklist'
import { PartnerHostNextStepsCard } from '@/components/partner/PartnerHostNextStepsCard'
import { PartnerReferralWelcomeStrip } from '@/components/partner/PartnerReferralWelcomeStrip'
import { PartnerDashboardQuickActions } from '@/components/partner/dashboard/PartnerDashboardQuickActions'
import { PartnerDashboardPendingFlow } from '@/components/partner/dashboard/PartnerDashboardPendingFlow'
import { PartnerDashboardReputationChip } from '@/components/partner/dashboard/PartnerDashboardReputationChip'
import { PartnerSuccessHelpDrawer } from '@/components/partner/dashboard/PartnerSuccessHelpDrawer'
import { PartnerDashboardMoneyCard } from '@/components/partner/dashboard/PartnerDashboardMoneyCard'
import {
  WelcomePartnerModal,
  RevenueSparkline,
  OccupancyRadial,
  PartnerDashboardLoadingSkeleton,
  PartnerDashboardIdentityGate,
  DASH_DATE_LOCALE,
  partnerListAmountThb,
} from '@/components/partner/dashboard/partner-dashboard-widgets'
import { usePartnerDashboardPage } from '@/hooks/partner/use-partner-dashboard-page'
import { PageSectionHeader } from '@/components/product/PageSectionHeader'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  MOBILE_FLAT_BRAND_CARD_CLASS,
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
  MOBILE_FLAT_EMPTY_CLASS,
} from '@/lib/ui/mobile-flat-canvas'
import { PartnerSectionDivider } from '@/components/partner/PartnerSectionDivider'
import {
  PARTNER_HUB_LIST_CARD_SURFACE_CLASS,
  PARTNER_SECTION_TITLE_CLASS,
} from '@/lib/ui/partner-section-rhythm'

export default function PartnerDashboardPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showPublishedModerationBanner, setShowPublishedModerationBanner] = useState(false)
  const [successHelpOpen, setSuccessHelpOpen] = useState(false)

  useEffect(() => {
    if (searchParams.get('published') === '1') {
      setShowPublishedModerationBanner(true)
      router.replace('/partner/dashboard', { scroll: false })
    }
  }, [searchParams, router])

  const {
    language,
    partnerId,
    authHydrating,
    refreshIdentity,
    stats,
    isLoading,
    isError,
    refetch,
    showWelcomeModal,
    setShowWelcomeModal,
    userName,
  } = usePartnerDashboardPage()

  const dashLocale = DASH_DATE_LOCALE[language] || ru
  const listingsCount = stats?.occupancy?.listingsCount ?? 0
  const isEmptyHost = !isLoading && listingsCount === 0

  if (authHydrating) {
    return <PartnerDashboardLoadingSkeleton />
  }

  if (!partnerId) {
    return <PartnerDashboardIdentityGate language={language} onRetry={refreshIdentity} />
  }

  if (isLoading) {
    return <PartnerDashboardLoadingSkeleton />
  }
  
  // Error state
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center px-4">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <h2 className="text-xl font-semibold text-slate-900">{getUIText('partnerDashboard_errorTitle', language)}</h2>
        <p className="text-sm text-slate-600 max-w-sm">{getUIText('partnerDashboard_errorBody', language)}</p>
        <Button onClick={() => refetch()} variant="brand">
          {getUIText('partnerDashboard_retry', language)}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {showPublishedModerationBanner ? (
        <Alert className="mb-4 rounded-2xl border-brand/25 bg-brand/5 text-slate-800">
          <Check className="h-4 w-4 text-brand" aria-hidden />
          <AlertTitle className="text-slate-900">
            {getUIText('partnerEdit_statusPending', language)}
          </AlertTitle>
          <AlertDescription>
            {getUIText('partnerDashboard_publishedModerationBanner', language)}
          </AlertDescription>
        </Alert>
      ) : null}

      <section data-partner-section="dashboard-alerts" className="space-y-3">
        <h2 className={PARTNER_SECTION_TITLE_CLASS}>
          {getUIText('partnerDashboard_sectionAlerts', language)}
        </h2>
        <PartnerDashboardPendingFlow
          pending={stats?.pending}
          partnerId={partnerId}
          language={language}
        />
        {(stats?.today?.checkIns > 0 || stats?.today?.checkOuts > 0) && (
          <Card
            className={cn(
              MOBILE_FLAT_BRAND_CARD_CLASS,
              'border-0 bg-gradient-to-r from-brand/90 to-brand text-white sm:rounded-2xl',
            )}
          >
            <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'sm:p-4')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5" />
                    <span className="font-medium">
                      {getUIText('partnerDashboard_checkInsCount', language).replace(
                        '{count}',
                        String(stats.today.checkIns),
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <UserMinus className="h-5 w-5" />
                    <span className="font-medium">
                      {getUIText('partnerDashboard_checkOutsCount', language).replace(
                        '{count}',
                        String(stats.today.checkOuts),
                      )}
                    </span>
                  </div>
                </div>
                <Badge variant="secondary" className="border-0 bg-white/20 text-white">
                  {getUIText('partnerDashboard_today', language)}
                </Badge>
              </div>
              {stats.today.checkInsList?.length > 0 && (
                <div className="mt-3 border-t border-white/20 pt-3">
                  <p className="text-sm text-white/80">
                    {getUIText('partnerDashboard_checkInsList', language).replace(
                      '{names}',
                      stats.today.checkInsList.map((c) => c.guestName).join(', '),
                    )}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        <PartnerHostVerificationBanner language={language} />
        <PartnerVerifiedBadgePromo language={language} />
        <PartnerDashboardReputationChip language={language} onOpen={() => setSuccessHelpOpen(true)} />
        <PartnerSuccessHelpDrawer
          open={successHelpOpen}
          onOpenChange={setSuccessHelpOpen}
          language={language}
        />
      </section>

      <PartnerSectionDivider />

      <section data-partner-section="dashboard-quick-actions" className="space-y-3">
        <PageSectionHeader
          title={getUIText('partnerDashboard_overviewTitle', language)}
          subtitle={format(new Date(), 'EEEE, d MMMM yyyy', { locale: dashLocale })}
          titleClassName="flex items-center gap-2"
        />
        <h2 className={PARTNER_SECTION_TITLE_CLASS}>
          {getUIText('partnerDashboard_sectionQuickActions', language)}
        </h2>
        <PartnerDashboardQuickActions language={language} onRefresh={() => refetch()} />
        <PartnerReferralWelcomeStrip />
        <PartnerOnboardingChecklist language={language} variant="compact" />
        <PartnerHostNextStepsCard language={language} partnerId={partnerId} variant="compact" />
      </section>

      <PartnerSectionDivider />

      <section data-partner-section="dashboard-metrics" className="space-y-3">
        <h2 className={PARTNER_SECTION_TITLE_CLASS}>
          {getUIText('partnerDashboard_sectionMetrics', language)}
        </h2>
        <PartnerDashboardMoneyCard language={language} />

        {isEmptyHost ? (
          <Card
            className={cn(
              MOBILE_FLAT_BRAND_CARD_CLASS,
              PARTNER_HUB_LIST_CARD_SURFACE_CLASS,
              'sm:bg-gradient-to-br sm:from-brand/5 sm:via-white sm:to-emerald-50/40',
            )}
            data-testid="partner-dashboard-zero-listings"
          >
            <CardContent
              className={cn(
                MOBILE_FLAT_CARD_CONTENT_CLASS,
                'flex flex-col items-center gap-4 text-center max-sm:py-8 sm:px-6 sm:py-10',
              )}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10">
                <Home className="h-8 w-8 text-brand" aria-hidden />
              </div>
              <div className="max-w-md space-y-2">
                <h3 className="text-lg font-semibold text-slate-900">
                  {getUIText('partnerDashboard_zeroListingsTitle', language)}
                </h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  {getUIText('partnerDashboard_zeroListingsDesc', language)}
                </p>
              </div>
              <Button asChild variant="brand" className="min-h-[44px] px-6">
                <Link href="/partner/listings/new">
                  {getUIText('partnerDashboard_newListing', language)}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-4">
            <Card
              className={cn(
                MOBILE_FLAT_CARD_CLASS,
                PARTNER_HUB_LIST_CARD_SURFACE_CLASS,
                'sm:hover:shadow-md sm:transition-shadow',
              )}
            >
              <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'sm:p-4')}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-500">
                    {getUIText('partnerDashboard_revenueLabel', language)}
                  </span>
                  <DollarSign className="h-4 w-4 text-brand" />
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-bold tabular-nums text-slate-900">
                      <PartnerHostLedgerAmount thb={stats?.revenue?.confirmed || 0} />
                    </p>
                    <p className="mt-0.5 text-xs tabular-nums text-slate-500">
                      {(() => {
                        const tpl = getUIText('partnerDashboard_revenuePending', language)
                        const [before = '', after = ''] = tpl.split('{amount}')
                        return (
                          <>
                            {before}
                            <PartnerHostLedgerAmount thb={stats?.revenue?.pending || 0} />
                            {after}
                          </>
                        )
                      })()}
                    </p>
                  </div>
                  <RevenueSparkline data={stats?.revenue?.trend} color={brandMintHex} height={40} />
                </div>
              </CardContent>
            </Card>

            <Card
              className={cn(
                MOBILE_FLAT_CARD_CLASS,
                PARTNER_HUB_LIST_CARD_SURFACE_CLASS,
                'sm:hover:shadow-md sm:transition-shadow',
              )}
            >
              <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'sm:p-4')}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-500">
                    {getUIText('partnerDashboard_occupancyLabel', language)}
                  </span>
                  <Calendar className="h-4 w-4 text-brand" />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    {getUIText('partnerDashboard_listingsCount', language).replace(
                      '{count}',
                      String(stats?.occupancy?.listingsCount || 0),
                    )}
                  </p>
                  <OccupancyRadial rate={stats?.occupancy?.rate || 0} size={80} language={language} />
                </div>
              </CardContent>
            </Card>

            <Card
              className={cn(
                MOBILE_FLAT_CARD_CLASS,
                PARTNER_HUB_LIST_CARD_SURFACE_CLASS,
                'sm:hover:shadow-md sm:transition-shadow',
                stats?.pending?.count > 0 && 'sm:ring-2 sm:ring-amber-400',
              )}
            >
              <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'sm:p-4')}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-500">
                    {getUIText('partnerDashboard_pendingLabel', language)}
                  </span>
                  <Bell
                    className={cn(
                      'h-4 w-4',
                      stats?.pending?.count > 0 ? 'animate-pulse text-amber-500' : 'text-slate-400',
                    )}
                  />
                </div>
                <p className="text-2xl font-bold text-slate-900">{stats?.pending?.count || 0}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {getUIText('partnerDashboard_pendingNewRequests', language)}
                </p>
                {stats?.pending?.count > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 min-h-[44px] w-full border-amber-300 text-amber-600 hover:bg-amber-50"
                    asChild
                  >
                    <Link href="/partner/bookings">
                      {getUIText('partnerDashboard_pendingView', language)}
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card
              className={cn(
                MOBILE_FLAT_CARD_CLASS,
                PARTNER_HUB_LIST_CARD_SURFACE_CLASS,
                'sm:hover:shadow-md sm:transition-shadow',
              )}
            >
              <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'sm:p-4')}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-500">
                    {getUIText('partnerDashboard_bookingsLabel', language)}
                  </span>
                  <Users className="h-4 w-4 text-brand" />
                </div>
                <p className="text-2xl font-bold text-slate-900">{stats?.bookings?.total || 0}</p>
                <div className="mt-2 flex gap-3 text-xs">
                  <span className="text-brand">✓ {stats?.bookings?.confirmed || 0}</span>
                  <span className="text-amber-600">◔ {stats?.bookings?.pending || 0}</span>
                  <span className="text-slate-400">✓✓ {stats?.bookings?.completed || 0}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </section>

      {!isEmptyHost ? (
        <>
          <PartnerSectionDivider />

          <section data-partner-section="dashboard-upcoming" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className={cn(PARTNER_SECTION_TITLE_CLASS, 'flex items-center gap-2')}>
                  <CalendarDays className="h-5 w-5 text-brand" aria-hidden />
                  {getUIText('partnerDashboard_sectionUpcoming', language)}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {getUIText('partnerDashboard_upcomingArrivalsDesc', language)}
                </p>
              </div>
              <Button variant="ghost" size="sm" asChild className="min-h-[44px] shrink-0">
                <Link href="/partner/calendar">
                  {getUIText('partnerDashboard_calendar', language)}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>

            {stats?.upcoming?.length > 0 ? (
              <div className="space-y-3">
                {stats.upcoming.map((arrival) => {
                  const arrLocale = DASH_DATE_LOCALE[language] || ru
                  const arrivalNetThb = partnerListAmountThb(arrival)
                  return (
                    <div
                      key={arrival.id}
                      className={cn(
                        PARTNER_HUB_LIST_CARD_SURFACE_CLASS,
                        'flex items-center gap-3 p-3 transition-colors sm:rounded-xl sm:bg-slate-50 sm:ring-1 sm:ring-slate-200/60',
                      )}
                    >
                      <div className="flex h-10 w-10 flex-shrink-0 flex-col items-center justify-center rounded-lg bg-brand/15">
                        <span className="text-xs font-bold text-brand-hover">
                          {arrival.checkIn && format(parseISO(arrival.checkIn), 'd')}
                        </span>
                        <span className="text-[10px] uppercase text-brand">
                          {arrival.checkIn &&
                            format(parseISO(arrival.checkIn), 'MMM', { locale: arrLocale })}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-900">{arrival.guestName}</p>
                        <p className="truncate text-xs text-slate-500">
                          {arrival.listingTitle} •{' '}
                          {durationPhraseForBookingEmail(
                            arrival.checkIn,
                            arrival.checkOut || arrival.checkIn,
                            language,
                            arrival.categorySlug ?? null,
                            Math.max(1, Number(arrival.nights) || 1),
                          )}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p
                          className="whitespace-nowrap text-sm font-medium tabular-nums text-brand"
                          title={getUIText('partnerDashboard_amountNetTooltip', language)}
                        >
                          <PartnerHostLedgerAmount thb={arrivalNetThb} />
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className={cn(MOBILE_FLAT_EMPTY_CLASS, 'text-slate-500')}>
                <Calendar className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                <p>{getUIText('partnerDashboard_noArrivals', language)}</p>
              </div>
            )}
          </section>
        </>
      ) : null}

      <WelcomePartnerModal
        isOpen={showWelcomeModal}
        onClose={() => setShowWelcomeModal(false)}
        onStartListing={() => router.push('/partner/listings/new')}
        userName={userName}
      />
    </div>
  )
}
