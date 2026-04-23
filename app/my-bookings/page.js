'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Star, Calendar, Loader2, ArrowLeft } from 'lucide-react'
import { useI18n } from '@/contexts/i18n-context'
import UnifiedOrderCard from '@/components/orders/UnifiedOrderCard'
import OrdersSummary from '@/components/orders/OrdersSummary'
import OrderTypeFilter from '@/components/orders/OrderTypeFilter'
import { OrdersListSkeleton, OrdersPageSkeleton } from '@/components/orders/OrdersSkeleton'
import { toast } from 'sonner'
import { processAndUploadReviewPhotos } from '@/lib/services/image-upload.service'

const MAX_REVIEW_PHOTOS = 5
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
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionBookingId, setActionBookingId] = useState(null)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [reviewPhotoFiles, setReviewPhotoFiles] = useState([])

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
    setRating(0)
    setComment('')
    setReviewPhotoFiles([])
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

  async function handleReviewSubmit(e) {
    e.preventDefault()

    if (!rating) {
      toast.error('Поставьте оценку')
      return
    }

    if (!comment.trim()) {
      toast.error('Напишите комментарий')
      return
    }

    if (!currentUserId) {
      toast.error('Войдите в аккаунт')
      return
    }

    const listingId = selectedBooking?.listing_id || selectedBooking?.listings?.id
    const bookingId = selectedBooking?.id

    if (!listingId || !bookingId) {
      toast.error('Недостаточно данных бронирования')
      return
    }

    setSubmitting(true)

    try {
      let photos = []
      if (reviewPhotoFiles.length > 0) {
        photos = await processAndUploadReviewPhotos(reviewPhotoFiles, currentUserId, bookingId)
        if (photos.length !== reviewPhotoFiles.length) {
          toast.error('Не удалось загрузить все фото')
          setSubmitting(false)
          return
        }
      }

      const res = await fetch('/api/v2/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          listingId,
          bookingId,
          rating,
          comment: comment.trim(),
          ...(photos.length ? { photos } : {}),
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (res.ok && data.success) {
        toast.success('Отзыв опубликован! Спасибо за ваше мнение.')
        setReviewModalOpen(false)
        setReviewPhotoFiles([])
        void loadBookings()
      } else {
        toast.error(data.error || 'Ошибка при публикации отзыва')
      }
    } catch (error) {
      console.error('Failed to submit review:', error)
      toast.error('Ошибка при публикации отзыва')
    } finally {
      setSubmitting(false)
    }
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

        <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Оставьте отзыв</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleReviewSubmit} className="space-y-6">
              <div>
                <Label className="text-base font-semibold mb-3 block">Ваша оценка</Label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        className={`h-10 w-10 ${
                          star <= (hoverRating || rating)
                            ? 'fill-amber-400 text-amber-400'
                            : 'fill-slate-200 text-slate-200'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                {rating > 0 && (
                  <p className="text-sm text-slate-600 mt-2">
                    {rating === 5 && '⭐ Отлично!'}
                    {rating === 4 && '😊 Хорошо'}
                    {rating === 3 && '🙂 Нормально'}
                    {rating === 2 && '😐 Так себе'}
                    {rating === 1 && '😞 Плохо'}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="comment" className="text-base font-semibold mb-3 block">
                  Ваш отзыв
                </Label>
                <Textarea
                  id="comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Поделитесь впечатлениями о вашей аренде..."
                  rows={5}
                  className="resize-none"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Имя в отзыве будет показано в формате «Имя Ф.» для конфиденциальности.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="review-photos-my-bookings" className="text-base font-semibold block">
                  Фото (необязательно, до {MAX_REVIEW_PHOTOS})
                </Label>
                <input
                  id="review-photos-my-bookings"
                  type="file"
                  accept="image/*"
                  multiple
                  className="text-sm text-slate-600 file:mr-2 file:rounded file:border file:border-slate-200 file:bg-white file:px-3 file:py-1"
                  disabled={reviewPhotoFiles.length >= MAX_REVIEW_PHOTOS}
                  onChange={(e) => {
                    const picked = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'))
                    e.target.value = ''
                    if (!picked.length) return
                    setReviewPhotoFiles((prev) => {
                      const next = [...prev, ...picked].slice(0, MAX_REVIEW_PHOTOS)
                      if (prev.length + picked.length > MAX_REVIEW_PHOTOS) {
                        toast.error(`Не более ${MAX_REVIEW_PHOTOS} фото`)
                      }
                      return next
                    })
                  }}
                />
                {reviewPhotoFiles.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{reviewPhotoFiles.length} файл(ов)</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setReviewPhotoFiles([])}>
                      Сбросить
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={!rating || !comment.trim() || submitting}
                  className="flex-1 bg-teal-600 hover:bg-teal-700"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Публикация...
                    </>
                  ) : (
                    <>
                      <Star className="h-4 w-4 mr-2" />
                      Опубликовать отзыв
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReviewModalOpen(false)}
                  disabled={submitting}
                >
                  Отмена
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
