'use client'

/**
 * Partner — review the guest after THAWED / COMPLETED (one review per booking).
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, ArrowLeft, Star, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

async function fetchBookingForPartner(bookingId) {
  const res = await fetch(`/api/v2/partner/bookings?limit=500`, {
    credentials: 'include',
    cache: 'no-store',
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error || 'Failed to load bookings')
  }
  const rows = json.data || []
  return rows.find((b) => String(b.id) === String(bookingId)) || null
}

export default function PartnerGuestReviewPage() {
  const params = useParams()
  const router = useRouter()
  const bookingId = params?.bookingId

  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState(null)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState(null)

  const load = useCallback(async () => {
    if (!bookingId) return
    setLoading(true)
    setLoadError(null)
    try {
      const b = await fetchBookingForPartner(bookingId)
      setBooking(b)
    } catch (e) {
      setLoadError(e.message)
      setBooking(null)
    } finally {
      setLoading(false)
    }
  }, [bookingId])

  useEffect(() => {
    load()
  }, [load])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!bookingId || rating < 1 || rating > 5) {
      toast.error('Выберите оценку от 1 до 5')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/v2/partner/guest-reviews', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, rating, comment }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Не удалось отправить отзыв')
      }
      toast.success('Спасибо! Отзыв о госте сохранён.')
      router.push('/partner/bookings')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!bookingId) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4">
        <p className="text-slate-600">Некорректная ссылка.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
      </div>
    )
  }

  if (loadError || !booking) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 space-y-4">
        <div className="flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {loadError || 'Бронирование не найдено'}
        </div>
        <Button variant="outline" asChild>
          <Link href="/partner/bookings">К списку бронирований</Link>
        </Button>
      </div>
    )
  }

  const allowed = booking.status === 'THAWED' || booking.status === 'COMPLETED'
  if (!allowed) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Отзыв о госте</CardTitle>
            <CardDescription>
              Оценка гостя доступна после разморозки средств (THAWED) или после завершения проживания (COMPLETED).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/partner/bookings">Назад к бронированиям</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!booking.canSubmitGuestReview) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Отзыв о госте</CardTitle>
            <CardDescription>Отзыв по этой брони уже оставлен.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/partner/bookings">Назад к бронированиям</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const guestLabel = booking.guestName || 'Гость'
  const listingTitle = booking.listing?.title || 'Объект'

  return (
    <div className="max-w-lg mx-auto py-8 px-4 space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link href="/partner/bookings" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Бронирования
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Оцените гостя</CardTitle>
          <CardDescription>
            {listingTitle} · {guestLabel}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label className="mb-3 block">Оценка (обязательно)</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    className="p-1 rounded-md hover:bg-amber-50 transition-colors"
                    aria-label={`${n} stars`}
                  >
                    <Star
                      className={`h-9 w-9 ${
                        n <= rating ? 'fill-amber-400 text-amber-500' : 'text-slate-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="comment">Комментарий (по желанию)</Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="mt-2 min-h-[120px]"
                placeholder="Как прошло общение, пунктуальность, бережное отношение к объекту…"
                maxLength={4000}
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-teal-600 hover:bg-teal-700"
              disabled={submitting || rating < 1}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Отправка…
                </>
              ) : (
                'Отправить отзыв'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
