/**
 * GoStayLo - Partner Bookings Page (v2 API)
 * 
 * STERILIZED: All data flows through API v2
 * Uses TanStack Query for reactive state management
 * 
 * @updated 2026-03-13 - Phase 1 Sterilization
 */

'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Calendar, Loader2, AlertCircle
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import UnifiedOrderCard from '@/components/orders/UnifiedOrderCard'
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

function toIsoOrNull(value) {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function inferTypeFromSlug(slug) {
  const s = String(slug || '').toLowerCase()
  if (s.includes('vehicle') || s.includes('transport') || s.includes('bike') || s.includes('car')) {
    return 'transport'
  }
  if (s.includes('tour') || s.includes('activity')) return 'activity'
  return 'home'
}

function buildPartnerUnifiedOrder(booking) {
  const listing = booking?.listing || booking?.listings || {}
  const categorySlug =
    listing?.category_slug ||
    listing?.category?.slug ||
    listing?.metadata?.category_slug ||
    booking?.metadata?.listing_category_slug
  return {
    id: String(booking?.id || ''),
    type: inferTypeFromSlug(categorySlug),
    status: String(booking?.status || '').toUpperCase(),
    total_price: Number(booking?.guestPayableThb ?? booking?.priceThb),
    currency: 'THB',
    dates: {
      check_in: toIsoOrNull(booking?.checkIn || booking?.check_in),
      check_out: toIsoOrNull(booking?.checkOut || booking?.check_out),
      created_at: toIsoOrNull(booking?.createdAt || booking?.created_at),
      updated_at: toIsoOrNull(booking?.updatedAt || booking?.updated_at),
    },
    metadata: booking?.metadata && typeof booking.metadata === 'object' ? booking.metadata : {},
  }
}

export default function PartnerBookings() {
  const { language } = useI18n()
  const searchParams = useSearchParams()
  const deepLinkHandled = useRef(false)
  const { user, loading: authLoading, isAuthenticated } = useAuth()
  const [filter, setFilter] = useState('all')
  const [activeType, setActiveType] = useState('all')
  const [rejectDialog, setRejectDialog] = useState({ open: false, bookingId: null })
  const [rejectReason, setRejectReason] = useState('')
  const [fallbackPartnerId, setFallbackPartnerId] = useState(null)

  // Fallback partnerId from localStorage (when useAuth is delayed or user from different source)
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

  // TanStack Query hook for bookings
  const { 
    data, 
    isLoading, 
    isError, 
    error,
    refetch
  } = usePartnerBookings(partnerId, {
    status: filter,
    enabled: !!partnerId
  })
  
  // Mutation hook for status updates
  const updateStatusMutation = useUpdateBookingStatus()
  
  // Extract bookings and meta from query response
  const bookings = data?.bookings || []
  const bookingsWithUnified = useMemo(
    () =>
      bookings.map((booking) => ({
        ...booking,
        _unified: buildPartnerUnifiedOrder(booking),
      })),
    [bookings],
  )

  const typeCounters = useMemo(() => {
    const counters = { all: bookingsWithUnified.length, home: 0, transport: 0, activity: 0 }
    for (const booking of bookingsWithUnified) {
      const type = booking?._unified?.type || 'home'
      if (counters[type] == null) counters[type] = 0
      counters[type] += 1
    }
    return counters
  }, [bookingsWithUnified])

  const visibleBookings = useMemo(() => {
    if (activeType === 'all') return bookingsWithUnified
    return bookingsWithUnified.filter((booking) => booking?._unified?.type === activeType)
  }, [activeType, bookingsWithUnified])

  const forcedAllForDeepLink = useRef(false)
  useEffect(() => {
    const tid = searchParams.get('booking')
    if (!tid || forcedAllForDeepLink.current) return
    forcedAllForDeepLink.current = true
    setFilter('all')
  }, [searchParams])

  // ?booking=id — скролл к карточке после загрузки списка (фильтр «все»)
  useEffect(() => {
    const tid = searchParams.get('booking')
    if (!tid || deepLinkHandled.current || !bookings?.length) return
    const exists = bookings.some((b) => String(b.id) === String(tid))
    if (!exists) {
      deepLinkHandled.current = true
      return
    }
    deepLinkHandled.current = true
    const tmr = window.setTimeout(() => {
      const safe = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(tid) : tid.replace(/"/g, '')
      const el = document.querySelector(`[data-booking-card="${safe}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.classList.add('ring-2', 'ring-teal-500', 'ring-offset-2', 'rounded-xl')
      window.setTimeout(() => {
        el?.classList.remove('ring-2', 'ring-teal-500', 'ring-offset-2', 'rounded-xl')
      }, 4000)
    }, 200)
    return () => window.clearTimeout(tmr)
  }, [bookings, searchParams])

  // Calculate stats from bookings
  const stats = {
    total: visibleBookings.length,
    pending: visibleBookings.filter(b => b.status === 'PENDING').length,
    confirmed: visibleBookings.filter(b =>
      ['CONFIRMED', 'AWAITING_PAYMENT', 'PAID', 'PAID_ESCROW', 'CHECKED_IN', 'THAWED'].includes(b.status)
    ).length,
    revenue: visibleBookings
      .filter(b =>
        ['CONFIRMED', 'AWAITING_PAYMENT', 'PAID', 'PAID_ESCROW', 'CHECKED_IN', 'THAWED', 'COMPLETED'].includes(
          b.status,
        ),
      )
      .reduce((sum, b) => sum + (b.partnerEarningsThb || 0), 0),
  }

  // Handle confirm booking
  const handleConfirm = (bookingOrId) => {
    const bookingId = typeof bookingOrId === 'string' ? bookingOrId : bookingOrId?.id
    if (!bookingId) return
    updateStatusMutation.mutate({
      bookingId,
      status: 'CONFIRMED',
      partnerId: user?.id
    })
  }

  // Handle reject booking (opens dialog)
  const handleRejectClick = (bookingOrId) => {
    const bookingId = typeof bookingOrId === 'string' ? bookingOrId : bookingOrId?.id
    if (!bookingId) return
    setRejectDialog({ open: true, bookingId })
    setRejectReason('')
  }

  // Submit rejection
  const handleRejectSubmit = () => {
    if (!rejectDialog.bookingId) return
    
    updateStatusMutation.mutate({
      bookingId: rejectDialog.bookingId,
      status: 'CANCELLED',
      reason: rejectReason,
      partnerId
    }, {
      onSuccess: () => {
        setRejectDialog({ open: false, bookingId: null })
        setRejectReason('')
      }
    })
  }

  // Handle complete booking
  const handleComplete = (bookingOrId) => {
    const bookingId = typeof bookingOrId === 'string' ? bookingOrId : bookingOrId?.id
    if (!bookingId) return
    updateStatusMutation.mutate({
      bookingId,
      status: 'COMPLETED',
      partnerId
    })
  }

  // Loading state
  if (authLoading || isLoading) {
    return (
      <div className="max-w-full overflow-x-hidden">
        <div className="space-y-4">
          <OrdersPageSkeleton />
        </div>
      </div>
    )
  }

  // Not authenticated
  if (!isAuthenticated && !fallbackPartnerId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <Calendar className="h-12 w-12 text-slate-300 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Требуется авторизация</h2>
        <p className="text-slate-500 text-center mb-6">
          Войдите в систему для просмотра бронирований
        </p>
        <Button asChild className="bg-teal-600 hover:bg-teal-700">
          <Link href="/profile?login=true">Войти</Link>
        </Button>
      </div>
    )
  }

  // Error state
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Ошибка загрузки</h2>
        <p className="text-slate-500 text-center mb-6">{error?.message || 'Не удалось загрузить бронирования'}</p>
        <Button onClick={() => refetch()} variant="outline">
          Попробовать снова
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Бронирования</h1>
        <p className="text-slate-600 mt-1">
          Управляйте заказами и общайтесь с клиентами
        </p>
      </div>

      <OrdersSummary role="partner" partnerStats={stats} />
      <OrderTypeFilter activeType={activeType} counters={typeCounters} onChange={setActiveType} />

      {/* Filter */}
      <div className="flex items-center gap-4 mb-4">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{getUIText('all', language)}</SelectItem>
            <SelectItem value="PENDING">{getUIText('chatBookingStatus_PENDING', language)}</SelectItem>
            <SelectItem value="CONFIRMED">{getUIText('chatBookingStatus_CONFIRMED', language)}</SelectItem>
            <SelectItem value="AWAITING_PAYMENT">{getUIText('chatBookingStatus_AWAITING_PAYMENT', language)}</SelectItem>
            <SelectItem value="PAID">{getUIText('chatBookingStatus_PAID', language)}</SelectItem>
            <SelectItem value="PAID_ESCROW">{getUIText('chatBookingStatus_PAID_ESCROW', language)}</SelectItem>
            <SelectItem value="COMPLETED">{getUIText('chatBookingStatus_COMPLETED', language)}</SelectItem>
            <SelectItem value="CANCELLED">{getUIText('chatBookingStatus_CANCELLED', language)}</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-slate-500">
          Показано: {visibleBookings.length}
        </span>
      </div>

      {/* Bookings List */}
      {visibleBookings.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Нет бронирований
            </h3>
            <p className="text-slate-600 text-center max-w-md">
              {filter !== 'all' 
                ? 'Нет бронирований с выбранным статусом'
                : 'Когда клиенты забронируют ваши объекты, они появятся здесь'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleBookings.map((booking) => (
            <div key={booking.id} data-testid={`booking-card-${booking.id}`}>
              <UnifiedOrderCard
                booking={booking}
                unifiedOrder={booking._unified}
                role="partner"
                language={language}
                cardAnchorId={booking.id}
                isBusy={updateStatusMutation.isPending}
                onConfirm={handleConfirm}
                onDecline={handleRejectClick}
                onComplete={handleComplete}
              />
              {booking.canSubmitGuestReview ? (
                <div className="mt-2">
                  <Button asChild variant="outline" className="border-amber-200 text-amber-900 hover:bg-amber-50">
                    <Link href={`/partner/bookings/${encodeURIComponent(booking.id)}/guest-review`}>
                      {getUIText('partnerBreadcrumb_reviews', language)}
                    </Link>
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog({ open, bookingId: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отклонить бронирование</DialogTitle>
            <DialogDescription>
              Укажите причину отклонения (необязательно). Гость получит уведомление.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Причина отклонения..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialog({ open: false, bookingId: null })}
            >
              Отмена
            </Button>
            <Button
              onClick={handleRejectSubmit}
              disabled={updateStatusMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {updateStatusMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Отклонить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
