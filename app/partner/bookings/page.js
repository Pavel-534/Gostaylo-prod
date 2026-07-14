/**
 * GoStayLo - Partner Bookings Page (v2 API)
 *
 * Stage 185.0 — Master-Detail: compact list + detail drawer + status tabs.
 */

'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Calendar, Loader2, AlertCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/auth-context'
import { usePartnerBookings, useUpdateBookingStatus } from '@/lib/hooks/use-partner-bookings'
import Link from 'next/link'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import OrdersSummary from '@/components/orders/OrdersSummary'
import OrderTypeFilter from '@/components/orders/OrderTypeFilter'
import { OrdersPageSkeleton } from '@/components/orders/OrdersSkeleton'
import { PartnerHostMidFxFootnote } from '@/components/partner/finances/partner-host-amount-display'
import { PartnerBookingStatusTabs } from '@/components/partner/bookings/PartnerBookingStatusTabs'
import { PartnerBookingList } from '@/components/partner/bookings/PartnerBookingList'
import { PageSectionHeader } from '@/components/product/PageSectionHeader'
import { PartnerPageShell } from '@/components/product/PartnerPageShell'
import {
  filterPartnerBookingsByTab,
  countPartnerBookingsByTab,
  tabForPartnerBookingDeepLink,
} from '@/lib/booking/partner-bookings-tabs'
import { buildPartnerUnifiedOrder } from '@/lib/partner/partner-booking-card-model'

export default function PartnerBookings() {
  const { language } = useI18n()
  const searchParams = useSearchParams()
  const router = useRouter()
  const deepLinkHandled = useRef(false)
  const { user, loading: authLoading, isAuthenticated } = useAuth()
  const [activeTab, setActiveTab] = useState('all')
  const [activeType, setActiveType] = useState('all')
  const [selectedBookingId, setSelectedBookingId] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [rejectDialog, setRejectDialog] = useState({ open: false, bookingId: null })
  const [rejectReason, setRejectReason] = useState('')
  const [fallbackPartnerId, setFallbackPartnerId] = useState(null)

  useEffect(() => {
    if (user?.id) return
    const stored = localStorage.getItem('gostaylo_user')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed?.id) setFallbackPartnerId(parsed.id)
      } catch {}
    }
  }, [user?.id])

  const partnerId = user?.id || fallbackPartnerId

  const { data, isLoading, isError, error, refetch } = usePartnerBookings(partnerId, {
    status: 'all',
    enabled: !!partnerId,
  })

  const updateStatusMutation = useUpdateBookingStatus()

  const bookings = data?.bookings || []
  const bookingsWithUnified = useMemo(
    () =>
      bookings.map((booking) => ({
        ...booking,
        _unified: buildPartnerUnifiedOrder(booking),
      })),
    [bookings],
  )

  const typeFilteredBookings = useMemo(() => {
    if (activeType === 'all') return bookingsWithUnified
    return bookingsWithUnified.filter((booking) => booking?._unified?.type === activeType)
  }, [activeType, bookingsWithUnified])

  const tabCounters = useMemo(() => countPartnerBookingsByTab(typeFilteredBookings), [typeFilteredBookings])

  const visibleBookings = useMemo(
    () => filterPartnerBookingsByTab(typeFilteredBookings, activeTab),
    [activeTab, typeFilteredBookings],
  )

  const typeCounters = useMemo(() => {
    const tabbed = filterPartnerBookingsByTab(bookingsWithUnified, activeTab)
    const counters = { all: tabbed.length, home: 0, transport: 0, activity: 0 }
    for (const booking of tabbed) {
      const type = booking?._unified?.type || 'home'
      if (counters[type] == null) counters[type] = 0
      counters[type] += 1
    }
    return counters
  }, [activeTab, bookingsWithUnified])

  const openBookingDrawer = useCallback((bookingId) => {
    setSelectedBookingId(String(bookingId))
    setDrawerOpen(true)
  }, [])

  const handleDrawerOpenChange = useCallback((open) => {
    setDrawerOpen(open)
    if (!open) {
      setSelectedBookingId(null)
      const tid = searchParams.get('booking')
      if (tid) {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('booking')
        const qs = params.toString()
        router.replace(qs ? `/partner/bookings?${qs}` : '/partner/bookings', { scroll: false })
      }
    }
  }, [router, searchParams])

  useEffect(() => {
    const tid = searchParams.get('booking')
    if (!tid || deepLinkHandled.current || !bookingsWithUnified.length) return
    const match = bookingsWithUnified.find((b) => String(b.id) === String(tid))
    if (!match) {
      deepLinkHandled.current = true
      return
    }
    deepLinkHandled.current = true
    setActiveTab(tabForPartnerBookingDeepLink(match))
    openBookingDrawer(match.id)
  }, [bookingsWithUnified, openBookingDrawer, searchParams])

  const stats = useMemo(
    () => ({
      total: visibleBookings.length,
      pending: visibleBookings.filter((b) => b.status === 'PENDING').length,
      confirmed: visibleBookings.filter((b) =>
        ['CONFIRMED', 'AWAITING_PAYMENT', 'PAID', 'PAID_ESCROW', 'CHECKED_IN', 'THAWED'].includes(b.status),
      ).length,
      revenue: visibleBookings
        .filter((b) =>
          ['CONFIRMED', 'AWAITING_PAYMENT', 'PAID', 'PAID_ESCROW', 'CHECKED_IN', 'THAWED', 'COMPLETED'].includes(
            b.status,
          ),
        )
        .reduce((sum, b) => sum + (b.partnerEarningsThb || 0), 0),
    }),
    [visibleBookings],
  )

  const handleConfirm = (bookingOrId) => {
    const bookingId = typeof bookingOrId === 'string' ? bookingOrId : bookingOrId?.id
    if (!bookingId) return
    updateStatusMutation.mutate({
      bookingId,
      status: 'CONFIRMED',
      partnerId: user?.id,
    })
  }

  const handleRejectClick = (bookingOrId) => {
    const bookingId = typeof bookingOrId === 'string' ? bookingOrId : bookingOrId?.id
    if (!bookingId) return
    setRejectDialog({ open: true, bookingId })
    setRejectReason('')
  }

  const handleRejectSubmit = () => {
    if (!rejectDialog.bookingId) return
    updateStatusMutation.mutate(
      {
        bookingId: rejectDialog.bookingId,
        status: 'CANCELLED',
        reason: rejectReason,
        partnerId,
      },
      {
        onSuccess: () => {
          setRejectDialog({ open: false, bookingId: null })
          setRejectReason('')
        },
      },
    )
  }

  const handleComplete = (bookingOrId) => {
    const bookingId = typeof bookingOrId === 'string' ? bookingOrId : bookingOrId?.id
    if (!bookingId) return
    updateStatusMutation.mutate({
      bookingId,
      status: 'COMPLETED',
      partnerId,
    })
  }

  if (authLoading || isLoading) {
    return (
      <div className="max-w-full overflow-x-hidden">
        <OrdersPageSkeleton />
      </div>
    )
  }

  if (!isAuthenticated && !fallbackPartnerId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
        <Calendar className="h-12 w-12 text-slate-300 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          {getUIText('partnerBookings_authRequiredTitle', language)}
        </h2>
        <p className="text-slate-500 text-center mb-6">{getUIText('partnerBookings_authRequiredBody', language)}</p>
        <Button asChild variant="brand">
          <Link href="/profile?login=true">{getUIText('partnerBookings_login', language)}</Link>
        </Button>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
        <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          {getUIText('partnerBookings_loadErrorTitle', language)}
        </h2>
        <p className="text-slate-500 text-center mb-6">{error?.message || getUIText('partnerDashboard_errorBody', language)}</p>
        <Button onClick={() => refetch()} variant="outline">
          {getUIText('partnerBookings_loadErrorRetry', language)}
        </Button>
      </div>
    )
  }

  return (
    <PartnerPageShell>
      <PageSectionHeader
        className="mb-6"
        title={getUIText('partnerBreadcrumb_bookings', language)}
        subtitle={getUIText('partnerBookings_pageSubtitle', language)}
      />

      <OrdersSummary role="partner" partnerStats={stats} language={language} />
      <PartnerHostMidFxFootnote t={(key) => getUIText(key, language)} className="mb-4" />

      <PartnerBookingStatusTabs
        activeTab={activeTab}
        counters={tabCounters}
        onChange={setActiveTab}
        language={language}
      />

      <OrderTypeFilter
        activeType={activeType}
        counters={typeCounters}
        onChange={setActiveType}
        language={language}
      />

      <p className="text-sm text-slate-500 mb-3">
        {getUIText('partnerBookings_shownCount', language, { count: visibleBookings.length })}
      </p>

      <PartnerBookingList
        bookings={visibleBookings}
        language={language}
        activeTab={activeTab}
        selectedBookingId={selectedBookingId}
        drawerOpen={drawerOpen}
        onDrawerOpenChange={handleDrawerOpenChange}
        onSelectBooking={openBookingDrawer}
        isBusy={updateStatusMutation.isPending}
        onConfirm={handleConfirm}
        onDecline={handleRejectClick}
        onComplete={handleComplete}
        onQuickConfirm={handleConfirm}
        onQuickDecline={handleRejectClick}
      />

      <Dialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog({ open, bookingId: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getUIText('partnerBookings_rejectTitle', language)}</DialogTitle>
            <DialogDescription>{getUIText('partnerBookings_rejectDesc', language)}</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder={getUIText('partnerBookings_rejectPlaceholder', language)}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, bookingId: null })}>
              {getUIText('partnerBookings_rejectCancel', language)}
            </Button>
            <Button
              onClick={handleRejectSubmit}
              disabled={updateStatusMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {updateStatusMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {getUIText('partnerBookings_rejectSubmit', language)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PartnerPageShell>
  )
}
