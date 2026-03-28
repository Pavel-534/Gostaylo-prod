'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Star, Calendar, MapPin, Loader2, ArrowLeft } from 'lucide-react'
import { formatPrice } from '@/lib/currency'
import { toast } from 'sonner'

export default function MyBookings() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
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

      const completed = data.data.filter((b) => String(b.status || '').toUpperCase() === 'COMPLETED')
      setBookings(completed)
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

  function openReviewModal(booking) {
    setSelectedBooking(booking)
    setRating(0)
    setComment('')
    setReviewModalOpen(true)
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
      const res = await fetch('/api/v2/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          listingId,
          bookingId,
          rating,
          comment: comment.trim(),
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (res.ok && data.success) {
        toast.success('Отзыв опубликован! Спасибо за ваше мнение.')
        setReviewModalOpen(false)
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-teal-600" />
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
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Мои завершённые бронирования</h1>
          <p className="text-slate-600">Оставьте отзывы о вашем опыте</p>
        </div>

        {bookings.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Calendar className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Нет завершённых бронирований</h3>
              <p className="text-slate-600 mb-4">После завершения аренды вы сможете оставить отзыв</p>
              <Button asChild className="bg-teal-600 hover:bg-teal-700">
                <Link href="/">Перейти к поиску</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => {
              const title = booking.listings?.title || 'Объект'
              const district = booking.listings?.district
              const checkIn = booking.check_in
              const checkOut = booking.check_out
              const priceThb = booking.price_thb ?? booking.total_amount_thb
              const isCompleted = String(booking.status || '').toUpperCase() === 'COMPLETED'

              return (
                <Card key={booking.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-xl mb-2">{title}</CardTitle>
                        <CardDescription className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>
                              {checkIn && checkOut
                                ? `${new Date(checkIn).toLocaleDateString('ru-RU')} — ${new Date(checkOut).toLocaleDateString('ru-RU')}`
                                : '—'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span>{district ? `${district}, Thailand` : 'Thailand'}</span>
                          </div>
                        </CardDescription>
                      </div>
                      <Badge className="bg-green-100 text-green-700">Завершено</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div>
                        <p className="text-sm text-slate-600 mb-1">Стоимость</p>
                        <p className="text-2xl font-bold text-slate-900">
                          {priceThb != null ? formatPrice(priceThb, 'THB') : '—'}
                        </p>
                      </div>
                      {isCompleted ? (
                        <Button
                          onClick={() => openReviewModal(booking)}
                          className="bg-teal-600 hover:bg-teal-700"
                        >
                          <Star className="h-4 w-4 mr-2" />
                          Оставить отзыв
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
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
