'use client'

/**
 * Оставить отзыв после поездки (ссылка из ChatMilestoneCard: ?bookingId=…)
 * Stage 28.0 — тот же ReviewModal и отправка, что и в /renter/bookings.
 */

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { ru, enUS, zhCN, th } from 'date-fns/locale'
import { Loader2, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ReviewModal } from '@/components/review-modal'
import { useReviewSubmission } from '@/hooks/use-review-submission'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { shouldAllowReviewByLifecycle } from '@/lib/orders/order-timeline'
import { cn } from '@/lib/utils'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_HEADER_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
} from '@/lib/ui/mobile-flat-canvas'

const DF_LOCALE = { ru, en: enUS, zh: zhCN, th }

function NewReviewContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { language } = useI18n()
  const bookingId = searchParams.get('bookingId')?.trim()
  const dfLocale = DF_LOCALE[language] || enUS

  const [me, setMe] = useState(null)
  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)

  const listing = booking?.listings
  const listingId = booking?.listing_id
  const title = listing?.title || getUIText('listing', language)
  const from = booking?.check_in
  const to = booking?.check_out
  let dateLine = ''
  try {
    if (from && to) {
      dateLine = `${format(new Date(from), 'd MMM', { locale: dfLocale })} — ${format(new Date(to), 'd MMM yyyy', { locale: dfLocale })}`
    }
  } catch {
    dateLine = ''
  }

  const { submitReview, isPending } = useReviewSubmission({
    language,
    userId: me?.id ?? null,
    onSuccess: () => {
      if (listingId) router.push(`/listings/${encodeURIComponent(listingId)}`)
      else router.push('/my-bookings')
    },
  })

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
        toast.error(getUIText('renterReviewLoginRequired', language))
        setMe(null)
        setBooking(null)
        return
      }
      setMe(meJson.user)

      if (!bookRes.ok || !bookJson.success || !bookJson.data) {
        toast.error(getUIText('renterReviewBookingNotFound', language))
        setBooking(null)
        return
      }
      setBooking(bookJson.data)
    } catch {
      toast.error(getUIText('renterReviewLoadError', language))
      setBooking(null)
    } finally {
      setLoading(false)
    }
  }, [bookingId, language])

  useEffect(() => {
    void load()
  }, [load])

  if (!bookingId) {
    return (
      <Card className={cn(MOBILE_FLAT_CARD_CLASS, 'max-w-lg mx-auto mt-8')}>
        <CardHeader className={MOBILE_FLAT_CARD_HEADER_CLASS}>
          <CardTitle>{getUIText('renterReviewFlow_title', language)}</CardTitle>
          <CardDescription>{getUIText('renterReviewFlow_noLinkDesc', language)}</CardDescription>
        </CardHeader>
        <CardContent className={MOBILE_FLAT_CARD_CONTENT_CLASS}>
          <Button asChild variant="outline">
            <Link href="/messages/">{getUIText('renterReviewFlow_toMessages', language)}</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-10 w-10 animate-spin text-brand" />
      </div>
    )
  }

  if (!me) {
    return (
      <Card className={cn(MOBILE_FLAT_CARD_CLASS, 'max-w-lg mx-auto mt-8')}>
        <CardHeader className={MOBILE_FLAT_CARD_HEADER_CLASS}>
          <CardTitle>{getUIText('renterReviewFlow_needLogin', language)}</CardTitle>
        </CardHeader>
        <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'space-y-3')}>
          <Button asChild variant="brand" className="min-h-11">
            <Link href={`/profile?login=true&redirect=${encodeURIComponent(`/renter/reviews/new?bookingId=${bookingId}`)}`}>
              {getUIText('renterReviewFlow_signIn', language)}
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!booking || !listingId) {
    return (
      <Card className={cn(MOBILE_FLAT_CARD_CLASS, 'max-w-lg mx-auto mt-8')}>
        <CardHeader className={MOBILE_FLAT_CARD_HEADER_CLASS}>
          <CardTitle>{getUIText('renterReviewFlow_notFound', language)}</CardTitle>
        </CardHeader>
        <CardContent className={MOBILE_FLAT_CARD_CONTENT_CLASS}>
          <Button asChild variant="outline">
            <Link href="/my-bookings">{getUIText('renterReviewFlow_myBookings', language)}</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (booking.renter_id && me?.id && booking.renter_id !== me.id) {
    return (
      <Card
        className={cn(
          MOBILE_FLAT_CARD_CLASS,
          'max-w-lg mx-auto mt-8 sm:border-red-200 sm:bg-red-50/40',
        )}
      >
        <CardHeader className={MOBILE_FLAT_CARD_HEADER_CLASS}>
          <CardTitle>{getUIText('renterReviewFlow_noAccess', language)}</CardTitle>
          <CardDescription>{getUIText('renterReviewFlow_noAccessDesc', language)}</CardDescription>
        </CardHeader>
        <CardContent className={MOBILE_FLAT_CARD_CONTENT_CLASS}>
          <Button asChild variant="outline">
            <Link href="/my-bookings">{getUIText('renterReviewFlow_myBookings', language)}</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const status = String(booking.status || '').toUpperCase()
  const canReview = shouldAllowReviewByLifecycle(status, booking.check_out)
  if (!canReview) {
    return (
      <Card
        className={cn(
          MOBILE_FLAT_CARD_CLASS,
          'max-w-lg mx-auto mt-8 sm:border-amber-200 sm:bg-amber-50/50',
        )}
      >
        <CardHeader className={MOBILE_FLAT_CARD_HEADER_CLASS}>
          <CardTitle>{getUIText('renterReviewFlow_notYet', language)}</CardTitle>
          <CardDescription>
            {getUIText('renterReviewFlow_notYetDesc', language)} {status || '—'}
          </CardDescription>
        </CardHeader>
        <CardContent className={MOBILE_FLAT_CARD_CONTENT_CLASS}>
          <Button asChild variant="outline">
            <Link href="/messages/">{getUIText('renterReviewFlow_toDialog', language)}</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <Button asChild variant="ghost" className="mb-4 -ml-2 min-h-11 text-slate-600">
        <Link href="/my-bookings">
          <ArrowLeft className="mr-1 h-4 w-4" />
          {getUIText('renterReviewFlow_back', language)}
        </Link>
      </Button>

      <Card className={cn(MOBILE_FLAT_CARD_CLASS, 'mb-4 sm:border-brand/20 sm:bg-brand/5')}>
        <CardHeader className={cn(MOBILE_FLAT_CARD_HEADER_CLASS, 'sm:pb-2')}>
          <CardTitle className="text-base">{getUIText('renterReviewFlow_rateTitle', language)}</CardTitle>
          <CardDescription>
            {title}
            {dateLine ? ` · ${dateLine}` : ''}
          </CardDescription>
        </CardHeader>
      </Card>

      <ReviewModal
        isOpen
        onClose={() => router.push('/my-bookings')}
        booking={booking}
        userId={me.id}
        language={language}
        categorySlug={listing?.category_slug ?? listing?.categorySlug ?? null}
        isSubmitting={isPending}
        onSubmit={async (reviewData) => {
          await submitReview({
            booking,
            ratings: reviewData.ratings,
            comment: reviewData.comment,
            photos: reviewData.photos || [],
          })
        }}
      />
    </div>
  )
}

export default function RenterNewReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <Loader2 className="h-10 w-10 animate-spin text-brand" />
        </div>
      }
    >
      <NewReviewContent />
    </Suspense>
  )
}
