'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, Loader2, ArrowLeft } from 'lucide-react'
import { useI18n } from '@/contexts/i18n-context'
import UnifiedOrderCard from '@/components/orders/UnifiedOrderCard'
import OrdersSummary from '@/components/orders/OrdersSummary'
import OrderTypeFilter from '@/components/orders/OrderTypeFilter'
import { OrdersListSkeleton, OrdersPageSkeleton } from '@/components/orders/OrdersSkeleton'
import { toast } from 'sonner'
import { ReviewModal } from '@/components/review-modal'
import { useReviewSubmission } from '@/hooks/use-review-submission'
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

export default function MyBookings() {
  const { language } = useI18n()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeSwitchLoading, setTypeSwitchLoading] = useState(false)
  const [activeType, setActiveType] = useState('all')
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState(null)
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
        { credentials: 'include', cache: 'no-store' }
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

  const typeCounters = useMemo(() => {
    const counters = { all: normalizedBookings.length, home: 0, transport: 0, activity: 0 }
    for (const booking of normalizedBookings) {
      const type = normalizeOrderType(booking.unified_order?.type)
      if (counters[type] == null) counters[type] = 0
      counters[type] += 1
    }
    return counters
  }, [normalizedBookings])

  const visibleBookings = useMemo(() => {
    if (activeType === 'all') return normalizedBookings
    return normalizedBookings.filter((booking) => normalizeOrderType(booking.unified_order?.type) === activeType)
  }, [activeType, normalizedBookings])

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

  async function handleCancelBooking(booking) {
    const bookingId = booking?.id
    if (!bookingId) return
    setActionBookingId(bookingId)
    try {
      const res = await fetch(`/api/v2/bookings/${encodeURIComponent(bookingId)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: 'Cancelled by renter from my-bookings' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Не удалось отменить бронирование')
        return
      }
      toast.success('Бронирование отменено')
      void loadBookings()
    } catch (error) {
      console.error('Failed to cancel booking:', error)
      toast.error('Не удалось отменить бронирование')
    } finally {
      setActionBookingId(null)
    }
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
        toast.error(data.error || 'Не удалось подтвердить заселение')
        return
      }
      toast.success('Заселение подтверждено')
      void loadBookings()
    } catch (error) {
      console.error('Failed to confirm check-in:', error)
      toast.error('Не удалось подтвердить заселение')
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
          <Link href="/" className="inline-flex items-center text-teal-600 hover:text-teal-700 mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            На главную
          </Link>
          <Card>
            <CardHeader>
              <CardTitle>Вход</CardTitle>
              <CardDescription>Войдите, чтобы видеть завершённые бронирования и оставлять отзывы.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild className="bg-teal-600 hover:bg-teal-700">
                <Link href="/profile?login=true&redirect=%2Fmy-bookings">Войти</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center text-teal-600 hover:text-teal-700 mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            На главную
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Мои заказы</h1>
          <p className="text-slate-600">Универсальный список бронирований жилья, транспорта и активностей</p>
        </div>

        <OrdersSummary role="renter" visibleCount={visibleBookings.length} currencyTotals={spendTotals} />
        <OrderTypeFilter activeType={activeType} counters={typeCounters} onChange={handleTypeSwitch} />

        {typeSwitchLoading ? (
          <OrdersListSkeleton count={2} />
        ) : visibleBookings.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Calendar className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Нет заказов для выбранного типа</h3>
              <p className="text-slate-600 mb-4">Выберите другой фильтр или создайте новое бронирование</p>
              <Button asChild className="bg-teal-600 hover:bg-teal-700">
                <Link href="/">Перейти к поиску</Link>
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
      </div>
    </div>
  )
}
