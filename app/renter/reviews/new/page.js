'use client'

/**
 * Оставить отзыв после поездки (ссылка из ChatMilestoneCard: ?bookingId=…)
 */

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Loader2, Star, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

function StarRow({ value, onChange, label }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="rounded p-0.5 text-amber-400 hover:scale-110 transition-transform"
            aria-label={`${n}`}
          >
            <Star className={`h-8 w-8 ${n <= value ? 'fill-current' : ''}`} />
          </button>
        ))}
      </div>
    </div>
  )
}

function NewReviewContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const bookingId = searchParams.get('bookingId')?.trim()

  const [me, setMe] = useState(null)
  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')

  const load = useCallback(async () => {
    if (!bookingId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [meRes, bookRes] = await Promise.all([
        fetch('/api/v2/auth/me', { credentials: 'include' }),
        fetch(`/api/v2/bookings/${encodeURIComponent(bookingId)}`, { credentials: 'include' }),
      ])
      const meJson = await meRes.json().catch(() => ({}))
      const bookJson = await bookRes.json().catch(() => ({}))

      if (!meRes.ok || !meJson.success || !meJson.user) {
        toast.error('Войдите в аккаунт')
        setMe(null)
        setBooking(null)
        return
      }
      setMe(meJson.user)

      if (!bookRes.ok || !bookJson.success || !bookJson.data) {
        toast.error('Бронирование не найдено')
        setBooking(null)
        return
      }
      setBooking(bookJson.data)
    } catch {
      toast.error('Ошибка загрузки')
      setBooking(null)
    } finally {
      setLoading(false)
    }
  }, [bookingId])

  useEffect(() => {
    void load()
  }, [load])

  const listing = booking?.listings
  const listingId = booking?.listing_id
  const title = listing?.title || 'Объект'
  const from = booking?.check_in
  const to = booking?.check_out
  let dateLine = ''
  try {
    if (from && to) {
      dateLine = `${format(new Date(from), 'd MMM', { locale: ru })} — ${format(new Date(to), 'd MMM yyyy', { locale: ru })}`
    }
  } catch {
    dateLine = ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!me?.id || !listingId || !bookingId) return
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
          comment: comment.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Не удалось отправить отзыв')
        return
      }
      toast.success('Ваш отзыв опубликован. Спасибо!')
      if (listingId) {
        router.push(`/listings/${encodeURIComponent(listingId)}`)
      } else {
        router.push('/renter/bookings')
      }
    } catch {
      toast.error('Ошибка сети')
    } finally {
      setSubmitting(false)
    }
  }

  if (!bookingId) {
    return (
      <Card className="max-w-lg mx-auto mt-8">
        <CardHeader>
          <CardTitle>Отзыв</CardTitle>
          <CardDescription>Откройте ссылку «Оценить отдых» из чата после завершения поездки.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/messages/">К сообщениям</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
      </div>
    )
  }

  if (!me) {
    return (
      <Card className="max-w-lg mx-auto mt-8">
        <CardHeader>
          <CardTitle>Нужен вход</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button asChild className="bg-teal-600 hover:bg-teal-700">
            <Link href={`/profile?login=true&redirect=${encodeURIComponent(`/renter/reviews/new?bookingId=${bookingId}`)}`}>
              Войти
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!booking || !listingId) {
    return (
      <Card className="max-w-lg mx-auto mt-8">
        <CardHeader>
          <CardTitle>Бронирование не найдено</CardTitle>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/renter/bookings">Мои бронирования</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (booking.renter_id && me?.id && booking.renter_id !== me.id) {
    return (
      <Card className="max-w-lg mx-auto mt-8 border-red-200 bg-red-50/40">
        <CardHeader>
          <CardTitle>Нет доступа</CardTitle>
          <CardDescription>Отзыв можно оставить только по своей брони.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/renter/bookings">Мои бронирования</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const status = String(booking.status || '').toUpperCase()
  if (status !== 'COMPLETED') {
    return (
      <Card className="max-w-lg mx-auto mt-8 border-amber-200 bg-amber-50/50">
        <CardHeader>
          <CardTitle>Отзыв пока недоступен</CardTitle>
          <CardDescription>
            Оставить отзыв можно после статуса «Завершено». Сейчас: {status || '—'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/messages/">К диалогу</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2 text-slate-600">
        <Link href="/renter/bookings">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Назад
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Оцените поездку</CardTitle>
          <CardDescription>
            {title}
            {dateLine ? ` · ${dateLine}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <StarRow value={rating} onChange={setRating} label="Общая оценка" />

            <div className="space-y-2">
              <Label htmlFor="review-comment">Комментарий (необязательно)</Label>
              <Textarea
                id="review-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                placeholder="Что понравилось, что улучшить?"
                className="resize-y min-h-[100px]"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-teal-600 hover:bg-teal-700"
              disabled={submitting || rating < 1}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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

export default function RenterNewReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
        </div>
      }
    >
      <NewReviewContent />
    </Suspense>
  )
}
