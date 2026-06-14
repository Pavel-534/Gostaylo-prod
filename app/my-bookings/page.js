'use client'

import { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar, ArrowLeft, Home } from 'lucide-react'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import UnifiedOrderCard from '@/components/orders/UnifiedOrderCard'
import OrdersSummary from '@/components/orders/OrdersSummary'
import OrderTypeFilter from '@/components/orders/OrderTypeFilter'
import { OrdersListSkeleton, OrdersPageSkeleton } from '@/components/orders/OrdersSkeleton'
import { ReviewModal } from '@/components/review-modal'
import { CancelBookingDialog } from '@/components/renter/cancel-booking-dialog'
import { useReviewSubmission } from '@/hooks/use-review-submission'
import {
  tabForBookingDeepLink,
  filterBookingsByStatusTab,
  countBookingsByStatusTab,
} from '@/lib/booking/my-bookings-tabs'
import { toast } from 'sonner'

const SWITCH_SKELETON_DELAY_MS = 120

function toIsoOrNull(value) {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function normalizeOrderType(type) {
  const t = String(type || '').trim().toLowerCase()
  if (t === 'transport') return 'transport'
  if (t === 'activity' || t === 'tour' || t === 'tours') return 'activity'
  return 'home'
}

function normalizeUnifiedOrder(booking) {
  if (booking?.unified_order && typeof booking.unified_order === 'object') {
    return {
      ...booking.unified_order,
      type: normalizeOrderType(booking.unified_order.type),
      status: String(booking.unified_order.status || booking.status || '').toUpperCase(),
      currency: String(booking.unified_order.currency || booking.currency || 'THB').toUpperCase(),
      total_price: Number(booking.unified_order.total_price),
      dates: {
        check_in: booking.unified_order?.dates?.check_in || toIsoOrNull(booking.check_in),
        check_out: booking.unified_order?.dates?.check_out || toIsoOrNull(booking.check_out),
        created_at: booking.unified_order?.dates?.created_at || toIsoOrNull(booking.created_at),
        updated_at: booking.unified_order?.dates?.updated_at || toIsoOrNull(booking.updated_at),
      },
      metadata:
        booking.unified_order?.metadata && typeof booking.unified_order.metadata === 'object'
          ? booking.unified_order.metadata
          : {},
    }
  }

  return {
    id: String(booking?.id || ''),
    type: normalizeOrderType(booking?.listings?.category_slug),
    status: String(booking?.status || '').toUpperCase(),
    total_price: Number(booking?.price_paid ?? booking?.price_thb),
    currency: String(booking?.currency || 'THB').toUpperCase(),
    dates: {
      check_in: toIsoOrNull(booking?.check_in),
      check_out: toIsoOrNull(booking?.check_out),
      created_at: toIsoOrNull(booking?.created_at),
      updated_at: toIsoOrNull(booking?.updated_at),
    },
    metadata: booking?.metadata && typeof booking.metadata === 'object' ? booking.metadata : {},
  }
}

function emptyStateCopy(activeTab, language) {
  switch (activeTab) {
    case 'upcoming':
      return {
        title: getUIText('noUpcomingTrips', language),
        body: getUIText('bookNextTrip', language),
      }
    case 'past':
      return {
        title: getUIText('noPastTrips', language),
        body: getUIText('noCompletedTrips', language),
      }
    case 'cancelled':
      return {
        title: getUIText('noCancelledBookings', language),
        body: getUIText('allBookingsActive', language),
      }
    default:
      return {
        title: getUIText('noBookings', language),
        body: getUIText('startSearchingPhuket', language),
      }
  }
}

function MyBookingsContent() {
  const { language } = useI18n()
  const searchParams = useSearchParams()
  const deepTabDone = useRef(false)
  const deepScrollDone = useRef(false)

  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeSwitchLoading, setTypeSwitchLoading] = useState(false)
  const [activeType, setActiveType] = useState('all')
  const [activeTab, setActiveTab] = useState('all')
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [cancelBookingId, setCancelBookingId] = useState(null)
  const [actionBookingId, setActionBookingId] = useState(null)
  const [currentUserId, setCurrentUserId] = useState(null)

  const loadBookings = useCallback(async () => {
    setLoading(true)
    try {
      const meRes = await fetch('/api/v2/auth/me', { credentials: 'include' })
      const meJson = await meRes.json().catch(() => ({}))

      if (!meRes.ok || !meJson.success || !meJson.user?.id) {
        setCurrentUserId(null)
        setBookings([])
        return
      }

      const userId = meJson.user.id
      setCurrentUserId(userId)

      const res = await fetch(
        `/api/v2/bookings?renterId=${encodeURIComponent(userId)}&limit=100`,
        { credentials: 'include', cache: 'no-store' },
      )
      const data = await res.json().catch(() => ({}))

      if (!res.ok || !data.success || !Array.isArray(data.data)) {
        setBookings([])
        return
      }

      setBookings(data.data)
    } catch (e) {
      console.error('Failed to load bookings:', e)
      setBookings([])
    } finally {
      setLoading(false)
    }
  }, [])

  const { submitReview, isPending: reviewSubmitPending } = useReviewSubmission({
    language,
    userId: currentUserId,
    onSuccess: () => {
      setReviewModalOpen(false)
      setSelectedBooking(null)
      void loadBookings()
    },
  })

  useEffect(() => {
    void loadBookings()
  }, [loadBookings])

  const normalizedBookings = useMemo(
    () =>
      bookings.map((booking) => ({
        ...booking,
        unified_order: normalizeUnifiedOrder(booking),
      })),
    [bookings],
  )

  const statusCounts = useMemo(
    () => countBookingsByStatusTab(normalizedBookings),
    [normalizedBookings],
  )

  const statusFilteredBookings = useMemo(
    () => filterBookingsByStatusTab(normalizedBookings, activeTab),
    [normalizedBookings, activeTab],
  )

  const typeCounters = useMemo(() => {
    const counters = { all: statusFilteredBookings.length, home: 0, transport: 0, activity: 0 }
    for (const booking of statusFilteredBookings) {
      const type = normalizeOrderType(booking.unified_order?.type)
      if (counters[type] == null) counters[type] = 0
      counters[type] += 1
    }
    return counters
  }, [statusFilteredBookings])

  const visibleBookings = useMemo(() => {
    if (activeType === 'all') return statusFilteredBookings
    return statusFilteredBookings.filter(
      (booking) => normalizeOrderType(booking.unified_order?.type) === activeType,
    )
  }, [activeType, statusFilteredBookings])

  const spendTotals = useMemo(() => {
    const byCurrency = new Map()
    for (const booking of visibleBookings) {
      const u = booking.unified_order || {}
      const currency = String(u.currency || 'THB').toUpperCase()
      const total = Number(u.total_price)
      if (!Number.isFinite(total)) continue
      byCurrency.set(currency, (byCurrency.get(currency) || 0) + total)
    }
    return Array.from(byCurrency.entries())
  }, [visibleBookings])

  useEffect(() => {
    const tid = searchParams.get('booking')
    if (!tid || deepTabDone.current || !normalizedBookings.length) return
    const b = normalizedBookings.find((x) => String(x.id) === String(tid))
    if (!b) {
      deepTabDone.current = true
      deepScrollDone.current = true
      return
    }
    deepTabDone.current = true
    setActiveTab(tabForBookingDeepLink(b))
  }, [normalizedBookings, searchParams])

  useEffect(() => {
    const tid = searchParams.get('booking')
    if (!tid || deepScrollDone.current) return
    const shown = visibleBookings.some((x) => String(x.id) === String(tid))
    if (!shown) return
    deepScrollDone.current = true
    const tmr = window.setTimeout(() => {
      const safe = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(tid) : tid.replace(/"/g, '')
      const el = document.querySelector(`[data-booking-card="${safe}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.classList.add('ring-2', 'ring-brand', 'ring-offset-2', 'rounded-2xl')
      window.setTimeout(() => {
        el?.classList.remove('ring-2', 'ring-brand', 'ring-offset-2', 'rounded-2xl')
      }, 4000)
    }, 200)
    return () => window.clearTimeout(tmr)
  }, [visibleBookings, searchParams])

  function handleTypeSwitch(type) {
    if (type === activeType) return
    setTypeSwitchLoading(true)
    setActiveType(type)
    window.setTimeout(() => setTypeSwitchLoading(false), SWITCH_SKELETON_DELAY_MS)
  }

  function openReviewModal(booking) {
    setSelectedBooking(booking)
    setReviewModalOpen(true)
  }

  function handleCancelBooking(booking) {
    const bookingId = booking?.id
    if (!bookingId) return
    setCancelBookingId(bookingId)
  }

  async function handleCheckInConfirm(booking) {
    const bookingId = booking?.id
    if (!bookingId) return
    setActionBookingId(bookingId)
    try {
      const res = await fetch(`/api/v2/bookings/${encodeURIComponent(bookingId)}/check-in/confirm`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) {
        toast.error(data.error || getUIText('myBookings_checkInError', language))
        return
      }
      toast.success(getUIText('myBookings_checkInSuccess', language))
      void loadBookings()
    } catch (error) {
      console.error('Failed to confirm check-in:', error)
      toast.error(getUIText('myBookings_checkInError', language))
    } finally {
      setActionBookingId(null)
    }
  }

  async function handleReviewSubmit(reviewData) {
    if (!selectedBooking) return
    await submitReview({
      booking: selectedBooking,
      ratings: reviewData.ratings,
      comment: reviewData.comment,
      photos: reviewData.photos || [],
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <OrdersPageSkeleton />
        </div>
      </div>
    )
  }

  if (!currentUserId) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="container mx-auto px-4 py-8 max-w-lg">
          <Link href="/" className="inline-flex items-center text-brand hover:text-brand/90 mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {getUIText('myBookings_backHome', language)}
          </Link>
          <Card>
            <CardHeader>
              <CardTitle>{getUIText('myBookings_loginTitle', language)}</CardTitle>
              <CardDescription>{getUIText('myBookings_loginDesc', language)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild variant="brand">
                <Link href="/profile?login=true&redirect=%2Fmy-bookings">
                  {getUIText('renterPortal_signInCta', language)}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const emptyCopy =
    activeType !== 'all' && statusFilteredBookings.length > 0
      ? {
          title: getUIText('myBookings_emptyTypeFilter', language),
          body: getUIText('myBookings_emptyTypeFilterHint', language),
        }
      : emptyStateCopy(activeTab, language)

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center text-brand hover:text-brand/90 mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {getUIText('myBookings_backHome', language)}
          </Link>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                {getUIText('myBookingsTitle', language)}
              </h1>
              <p className="text-slate-600">{getUIText('myBookings_pageSubtitle', language)}</p>
            </div>
            <Link href="/listings" className="shrink-0">
              <Button variant="brand" className="w-full sm:w-auto">
                <Home className="h-4 w-4 mr-2" />
                {getUIText('findStay', language)}
              </Button>
            </Link>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex h-auto w-full max-w-full flex-nowrap items-stretch justify-start gap-1 overflow-x-auto overflow-y-hidden rounded-lg bg-muted p-1 [scrollbar-width:none] lg:inline-grid lg:w-auto lg:grid-cols-4 lg:overflow-visible [&::-webkit-scrollbar]:hidden mb-6">
            {(['all', 'upcoming', 'past', 'cancelled']).map((tab) => {
              const labelKey = tab === 'all' ? 'all' : tab
              const count = statusCounts[tab]
              const badgeClass =
                tab === 'all'
                  ? 'bg-brand/10 text-brand'
                  : tab === 'upcoming'
                    ? 'bg-blue-100 text-blue-700'
                    : tab === 'past'
                      ? 'bg-slate-200 text-slate-700'
                      : 'bg-red-100 text-red-700'
              return (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="shrink-0 flex-col gap-1 px-3 py-2 text-xs data-[state=active]:shadow-sm lg:flex-row lg:text-sm"
                >
                  <span className="whitespace-nowrap">{getUIText(labelKey, language)}</span>
                  {count > 0 ? (
                    <Badge variant="secondary" className={`shrink-0 ${badgeClass}`}>
                      {count}
                    </Badge>
                  ) : null}
                </TabsTrigger>
              )
            })}
          </TabsList>

          <TabsContent value={activeTab} className="mt-0">
            <OrdersSummary role="renter" visibleCount={visibleBookings.length} currencyTotals={spendTotals} />
            <OrderTypeFilter activeType={activeType} counters={typeCounters} onChange={handleTypeSwitch} />

            {typeSwitchLoading ? (
              <OrdersListSkeleton count={2} />
            ) : visibleBookings.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Calendar className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">{emptyCopy.title}</h3>
                  <p className="text-slate-600 mb-4">{emptyCopy.body}</p>
                  <Button asChild variant="brand">
                    <Link href="/listings">{getUIText('myBookings_goSearch', language)}</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {visibleBookings.map((booking) => (
                  <UnifiedOrderCard
                    key={booking.id}
                    booking={booking}
                    unifiedOrder={booking.unified_order}
                    role="renter"
                    language={language}
                    isBusy={actionBookingId === booking.id}
                    onReview={openReviewModal}
                    onCancel={handleCancelBooking}
                    onCheckIn={handleCheckInConfirm}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <ReviewModal
          isOpen={reviewModalOpen}
          onClose={() => {
            setReviewModalOpen(false)
            setSelectedBooking(null)
          }}
          booking={selectedBooking}
          userId={currentUserId}
          onSubmit={handleReviewSubmit}
          isSubmitting={reviewSubmitPending}
          language={language}
          categorySlug={
            selectedBooking
              ? (selectedBooking.listing || selectedBooking.listings || {}).category_slug ??
                (selectedBooking.listing || selectedBooking.listings || {}).categorySlug ??
                null
              : null
          }
        />

        <CancelBookingDialog
          open={!!cancelBookingId}
          onOpenChange={(open) => {
            if (!open) setCancelBookingId(null)
          }}
          bookingId={cancelBookingId}
          language={language}
          onCancelled={() => {
            setCancelBookingId(null)
            void loadBookings()
            toast.success(getUIText('myBookings_cancelSuccess', language))
          }}
        />
      </div>
    </div>
  )
}

export default function MyBookings() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50">
          <div className="container mx-auto px-4 py-8 max-w-4xl">
            <OrdersPageSkeleton />
          </div>
        </div>
      }
    >
      <MyBookingsContent />
    </Suspense>
  )
}
