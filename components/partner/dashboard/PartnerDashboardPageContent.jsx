'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { durationPhraseForBookingEmail } from '@/lib/email/booking-email-i18n'
import { ru, enUS, zhCN, th as thLocale } from 'date-fns/locale'
import {
  TrendingDown, Calendar, DollarSign, Users,
  Home, Clock, Check, ArrowRight, Plus, Lock, Download, Tag,
  Loader2, AlertCircle, ChevronRight, UserCheck, UserMinus,
  CalendarDays, BarChart3, RefreshCw, Bell, Banknote,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatPrice } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { getUIText } from '@/lib/translations'
import { getHostMoneyStage, getHostMoneyPolicyForListing } from '@/lib/booking/host-money-stage'
import { brandMintHex } from '@/lib/theme/tokens'
import { PartnerReputationSection } from '@/components/partner/PartnerReputationSection'
import PartnerHostVerificationBanner from '@/components/partner/PartnerHostVerificationBanner'
import { PartnerVerifiedBadgePromo } from '@/components/partner/PartnerVerifiedBadgePromo'
import { PartnerOnboardingChecklist } from '@/components/partner/PartnerOnboardingChecklist'
import { PartnerHostNextStepsCard } from '@/components/partner/PartnerHostNextStepsCard'
import { PartnerDashboardWalletOverview } from '@/components/wallet/PartnerDashboardWalletOverview'
import { PartnerReferralWelcomeStrip } from '@/components/partner/PartnerReferralWelcomeStrip'
import {
  WelcomePartnerModal,
  RevenueSparkline,
  OccupancyRadial,
  PendingBookingCard,
  PartnerDashboardLoadingSkeleton,
  PartnerDashboardIdentityGate,
  DASH_DATE_LOCALE,
  partnerListAmountThb,
} from '@/components/partner/dashboard/partner-dashboard-widgets'
import { usePartnerDashboardPage } from '@/hooks/partner/use-partner-dashboard-page'
import { PageSectionHeader } from '@/components/product/PageSectionHeader'
import { GSL_CARD } from '@/lib/theme/product-ui'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

const PartnerDashboardIncomeChart = dynamic(
  () => import('@/components/partner/dashboard/PartnerDashboardIncomeChart'),
  {
    ssr: false,
    loading: () => <div className="h-full min-h-[220px] rounded-xl gsl-shimmer bg-slate-100/80" aria-hidden />,
  },
)

export default function PartnerDashboardPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showPublishedModerationBanner, setShowPublishedModerationBanner] = useState(false)

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
    incomeChartEmpty,
    handleApprove,
    handleDecline,
    isUpdatingBooking,
    showWelcomeModal,
    setShowWelcomeModal,
    userName,
  } = usePartnerDashboardPage()

  const dashLocale = DASH_DATE_LOCALE[language] || ru

  const payoutCategorySlug = useMemo(() => {
    const fromStats = stats?.financialV2?.dominantCategorySlug
    if (typeof fromStats === 'string' && fromStats.trim()) return fromStats.trim().toLowerCase()
    return 'property'
  }, [stats?.financialV2?.dominantCategorySlug])

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
    <div className="space-y-6">
      {showPublishedModerationBanner ? (
        <Alert className="rounded-2xl border-brand/25 bg-brand/5 text-slate-800">
          <Check className="h-4 w-4 text-brand" aria-hidden />
          <AlertTitle className="text-slate-900">
            {getUIText('partnerEdit_statusPending', language)}
          </AlertTitle>
          <AlertDescription>
            {getUIText('partnerDashboard_publishedModerationBanner', language)}
          </AlertDescription>
        </Alert>
      ) : null}
      <PartnerDashboardWalletOverview />
      <PartnerReferralWelcomeStrip />
      <PartnerOnboardingChecklist language={language} />
      <PartnerHostNextStepsCard language={language} partnerId={partnerId} />

      <PageSectionHeader
        title={getUIText('partnerDashboard_overviewTitle', language)}
        subtitle={format(new Date(), 'EEEE, d MMMM yyyy', { locale: dashLocale })}
        titleClassName="flex items-center gap-2"
        action={
          <div className="flex gap-2 flex-wrap">
          <Button asChild variant="brand">
            <Link href="/partner/listings/new">
              <Plus className="h-4 w-4 mr-2" />
              {getUIText('partnerDashboard_newListing', language)}
            </Link>
          </Button>
          <Button 
            variant="outline" 
            asChild
          >
            <Link href="/partner/calendar">
              <Lock className="h-4 w-4 mr-2" />
              {getUIText('partnerDashboard_blockDates', language)}
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/partner/promo">
              <Tag className="h-4 w-4 mr-2" />
              {getUIText('partnerNav_promo', language)}
            </Link>
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => refetch()}
            title={getUIText('partnerDashboard_refresh', language)}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        }
      />

      <PartnerHostVerificationBanner language={language} />
      <PartnerVerifiedBadgePromo language={language} />

      <PartnerReputationSection language={language} />

      {/* Today's Summary Banner */}
      {(stats?.today?.checkIns > 0 || stats?.today?.checkOuts > 0) && (
        <Card className="bg-gradient-to-r from-brand/90 to-brand border-0 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  <span className="font-medium">
                    {getUIText('partnerDashboard_checkInsCount', language).replace('{count}', String(stats.today.checkIns))}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <UserMinus className="h-5 w-5" />
                  <span className="font-medium">
                    {getUIText('partnerDashboard_checkOutsCount', language).replace('{count}', String(stats.today.checkOuts))}
                  </span>
                </div>
              </div>
              <Badge variant="secondary" className="bg-white/20 text-white border-0">
                {getUIText('partnerDashboard_today', language)}
              </Badge>
            </div>
            {stats.today.checkInsList?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/20">
                <p className="text-sm text-white/80">
                  {getUIText('partnerDashboard_checkInsList', language).replace(
                    '{names}',
                    stats.today.checkInsList.map(c => c.guestName).join(', '),
                  )}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue Widget */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-500">{getUIText('partnerDashboard_revenueLabel', language)}</span>
              <DollarSign className="h-4 w-4 text-brand" />
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {formatPrice(stats?.revenue?.confirmed || 0, 'THB')}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {getUIText('partnerDashboard_revenuePending', language).replace(
                    '{amount}',
                    formatPrice(stats?.revenue?.pending || 0, 'THB'),
                  )}
                </p>
              </div>
              <RevenueSparkline data={stats?.revenue?.trend} color={brandMintHex} height={40} />
            </div>
          </CardContent>
        </Card>

        {/* Occupancy Widget */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-500">{getUIText('partnerDashboard_occupancyLabel', language)}</span>
              <Calendar className="h-4 w-4 text-brand" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {stats?.occupancy?.rate || 0}%
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {getUIText('partnerDashboard_listingsCount', language).replace(
                    '{count}',
                    String(stats?.occupancy?.listingsCount || 0),
                  )}
                </p>
              </div>
              <OccupancyRadial rate={stats?.occupancy?.rate || 0} size={80} />
            </div>
          </CardContent>
        </Card>

        {/* Pending Actions Widget */}
        <Card className={cn(
          "border-0 shadow-sm hover:shadow-md transition-shadow",
          stats?.pending?.count > 0 && "ring-2 ring-amber-400"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-500">{getUIText('partnerDashboard_pendingLabel', language)}</span>
              <Bell className={cn("h-4 w-4", stats?.pending?.count > 0 ? "text-amber-500 animate-pulse" : "text-slate-400")} />
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {stats?.pending?.count || 0}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {getUIText('partnerDashboard_pendingNewRequests', language)}
            </p>
            {stats?.pending?.count > 0 && (
              <Button 
                size="sm" 
                variant="outline" 
                className="mt-2 w-full text-amber-600 border-amber-300 hover:bg-amber-50"
                asChild
              >
                <Link href="/partner/bookings">
                  {getUIText('partnerDashboard_pendingView', language)}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Bookings Summary Widget */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-500">{getUIText('partnerDashboard_bookingsLabel', language)}</span>
              <Users className="h-4 w-4 text-brand" />
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {stats?.bookings?.total || 0}
            </p>
            <div className="flex gap-3 mt-2 text-xs">
              <span className="text-brand">✓ {stats?.bookings?.confirmed || 0}</span>
              <span className="text-amber-600">◔ {stats?.bookings?.pending || 0}</span>
              <span className="text-slate-400">✓✓ {stats?.bookings?.completed || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Финансы: график выплат + средства в эскроу */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-brand" />
              {getUIText('partnerDashboard_incomeByMonthTitle', language)}
            </CardTitle>
            <CardDescription>
              {getUIText('partnerDashboard_incomeByMonthDesc', language)}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[260px] pt-0">
            {incomeChartEmpty ? (
              <div className="h-full min-h-[220px] flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-gradient-to-b from-slate-50/80 to-white px-6 text-center">
                <BarChart3 className="h-12 w-12 text-slate-300 mb-3" aria-hidden />
                <p className="text-sm text-slate-600 max-w-md leading-relaxed">
                  {getUIText('partnerDashboard_incomeEmpty', language)}
                </p>
                <p className="text-xs text-slate-400 mt-2 max-w-sm">
                  {getUIText('partnerDashboard_incomeEmptyHint', language)}
                </p>
              </div>
            ) : (
              <PartnerDashboardIncomeChart rows={stats?.financialV2?.incomeByMonth || []} />
            )}
          </CardContent>
        </Card>

        <Link
          href="/partner/finances?status=PAID_ESCROW"
          className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <Card className="shadow-sm border border-slate-100 border-l-4 border-l-brand h-full transition-shadow hover:shadow-md cursor-pointer">
            <CardContent className="p-5 flex flex-col h-full justify-between gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-500">{getUIText('partnerDashboard_futureIncomeLabel', language)}</span>
                  <Banknote className="h-5 w-5 text-brand" />
                </div>
                <p className="text-3xl font-bold text-slate-900 tabular-nums">
                  {formatPrice(stats?.financialV2?.moneyInTransitThb ?? 0, 'THB')}
                </p>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                {getHostMoneyStage('PAID_ESCROW', language, { categorySlug: payoutCategorySlug })?.eta ||
                  getHostMoneyPolicyForListing({ categorySlug: payoutCategorySlug }, language).protected ||
                  getUIText('partnerDashboard_futureIncomeDesc', language)}
              </p>
              <p className="text-xs font-medium text-brand-hover flex items-center gap-1">
                {getUIText('partnerDashboard_futureIncomeMore', language)}
                <ChevronRight className="h-3.5 w-3.5" />
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Approvals */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-500" />
                  {getUIText('partnerDashboard_pendingApprovalsTitle', language)}
                </CardTitle>
                <CardDescription>{getUIText('partnerDashboard_pendingApprovalsDesc', language)}</CardDescription>
              </div>
              {stats?.pending?.count > 0 && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                  {stats.pending.count}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats?.pending?.items?.length > 0 ? (
              stats.pending.items.map(booking => (
                <PendingBookingCard
                  key={booking.id}
                  booking={booking}
                  onApprove={handleApprove}
                  onDecline={handleDecline}
                  isLoading={isUpdatingBooking}
                  language={language}
                />
              ))
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Check className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p>{getUIText('partnerDashboard_allProcessed', language)}</p>
              </div>
            )}
            
            {stats?.pending?.count > 3 && (
              <Button variant="ghost" className="w-full mt-2" asChild>
                <Link href="/partner/bookings">
                  {getUIText('partnerDashboard_showAll', language).replace('{count}', String(stats.pending.count))}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Arrivals */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-brand" />
                  {getUIText('partnerDashboard_upcomingArrivalsTitle', language)}
                </CardTitle>
                <CardDescription>{getUIText('partnerDashboard_upcomingArrivalsDesc', language)}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/partner/calendar">
                  {getUIText('partnerDashboard_calendar', language)}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {stats?.upcoming?.length > 0 ? (
              <div className="space-y-3">
                {stats.upcoming.map((arrival) => {
                  const arrLocale = DASH_DATE_LOCALE[language] || ru
                  const arrivalNetThb = partnerListAmountThb(arrival)
                  return (
                  <div 
                    key={arrival.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex-shrink-0 w-10 h-10 bg-brand/15 rounded-lg flex flex-col items-center justify-center">
                      <span className="text-xs font-bold text-brand-hover">
                        {arrival.checkIn && format(parseISO(arrival.checkIn), 'd')}
                      </span>
                      <span className="text-[10px] text-brand uppercase">
                        {arrival.checkIn && format(parseISO(arrival.checkIn), 'MMM', { locale: arrLocale })}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">{arrival.guestName}</p>
                      <p className="text-xs text-slate-500 truncate">
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
                    <div className="text-right">
                      <p
                        className="text-sm font-medium text-brand"
                        title={getUIText('partnerDashboard_amountNetTooltip', language)}
                      >
                        {formatPrice(arrivalNetThb, 'THB')}
                      </p>
                    </div>
                  </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Calendar className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                <p>{getUIText('partnerDashboard_noArrivals', language)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-slate-50 to-slate-100">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 justify-center">
            <Button variant="outline" asChild>
              <Link href="/partner/listings">
                <Home className="h-4 w-4 mr-2" />
                {getUIText('partnerNav_listings', language)}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/partner/calendar">
                <CalendarDays className="h-4 w-4 mr-2" />
                {getUIText('partnerDashboard_masterCalendar', language)}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/partner/bookings">
                <Users className="h-4 w-4 mr-2" />
                {getUIText('partnerDashboard_allBookings', language)}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/partner/finances">
                <DollarSign className="h-4 w-4 mr-2" />
                {getUIText('partnerDashboard_finances', language)}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Welcome Partner Modal */}
      <WelcomePartnerModal
        isOpen={showWelcomeModal}
        onClose={() => setShowWelcomeModal(false)}
        onStartListing={() => router.push('/partner/listings/new')}
        userName={userName}
      />
    </div>
  )
}
