'use client'

/**
 * Partner — review the guest after THAWED / COMPLETED (one review per booking).
 * Stage 200.112 — UI copy via getUIText (no guest-review API change).
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, Star, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
  MOBILE_FLAT_CARD_HEADER_CLASS,
} from '@/lib/ui/mobile-flat-canvas'
import {
  PARTNER_FIELD_LABEL_CLASS,
  PARTNER_HUB_LIST_CARD_SURFACE_CLASS,
  PARTNER_SECTION_TITLE_CLASS,
} from '@/lib/ui/partner-section-rhythm'
import { cn } from '@/lib/utils'

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
  const { language } = useI18n()
  const t = useCallback((key, ctx) => getUIText(key, language, ctx), [language])
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
      toast.error(t('partnerGuestReview_needRating'))
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
        throw new Error(json.error || t('partnerGuestReview_submitFailed'))
      }
      toast.success(t('partnerGuestReview_success'))
      router.push('/partner/bookings')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!bookingId) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <p className="text-slate-600">{t('partnerGuestReview_invalidLink')}</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-brand" />
      </div>
    )
  }

  if (loadError || !booking) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-12">
        <div className="flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {loadError || t('partnerGuestReview_notFound')}
        </div>
        <Button variant="outline" asChild className="min-h-[44px]">
          <Link href="/partner/bookings">{t('partnerGuestReview_toBookingsList')}</Link>
        </Button>
      </div>
    )
  }

  const allowed = booking.status === 'THAWED' || booking.status === 'COMPLETED'
  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-12">
        <section data-partner-section="guest-review-blocked" className="space-y-3">
          <h2 className={PARTNER_SECTION_TITLE_CLASS}>{t('partnerGuestReview_pageTitle')}</h2>
          <Card className={cn(MOBILE_FLAT_CARD_CLASS, PARTNER_HUB_LIST_CARD_SURFACE_CLASS)}>
            <CardHeader className={MOBILE_FLAT_CARD_HEADER_CLASS}>
              <CardTitle className="sr-only">{t('partnerGuestReview_pageTitle')}</CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                {t('partnerGuestReview_blockedBody')}
              </CardDescription>
            </CardHeader>
            <CardContent className={MOBILE_FLAT_CARD_CONTENT_CLASS}>
              <Button asChild variant="brand" className="min-h-[44px]">
                <Link href="/partner/bookings">{t('partnerGuestReview_backBookings')}</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    )
  }

  if (!booking.canSubmitGuestReview) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-12">
        <section data-partner-section="guest-review-done" className="space-y-3">
          <h2 className={PARTNER_SECTION_TITLE_CLASS}>{t('partnerGuestReview_pageTitle')}</h2>
          <Card className={cn(MOBILE_FLAT_CARD_CLASS, PARTNER_HUB_LIST_CARD_SURFACE_CLASS)}>
            <CardHeader className={MOBILE_FLAT_CARD_HEADER_CLASS}>
              <CardTitle className="sr-only">{t('partnerGuestReview_pageTitle')}</CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                {t('partnerGuestReview_alreadyDone')}
              </CardDescription>
            </CardHeader>
            <CardContent className={MOBILE_FLAT_CARD_CONTENT_CLASS}>
              <Button asChild variant="brand" className="min-h-[44px]">
                <Link href="/partner/bookings">{t('partnerGuestReview_backBookings')}</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    )
  }

  const guestLabel = booking.guestName || t('partnerGuestReview_guestFallback')
  const listingTitle = booking.listing?.title || t('partnerGuestReview_listingFallback')

  return (
    <div className="mx-auto max-w-lg space-y-0 px-4 py-8">
      <section data-partner-section="guest-review-form" className="space-y-3">
        <h2 className={PARTNER_SECTION_TITLE_CLASS}>{t('partnerGuestReview_rateTitle')}</h2>
        <p className="text-xs leading-relaxed text-slate-500">
          {listingTitle} · {guestLabel}
        </p>
        <Card className={cn(MOBILE_FLAT_CARD_CLASS, PARTNER_HUB_LIST_CARD_SURFACE_CLASS)}>
          <CardHeader className={MOBILE_FLAT_CARD_HEADER_CLASS}>
            <CardTitle className="sr-only">{t('partnerGuestReview_rateTitle')}</CardTitle>
          </CardHeader>
          <CardContent className={MOBILE_FLAT_CARD_CONTENT_CLASS}>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-1.5">
                <Label className={PARTNER_FIELD_LABEL_CLASS}>
                  {t('partnerGuestReview_ratingLabel')}
                </Label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-1 transition-colors hover:bg-amber-50"
                      aria-label={t('partnerGuestReview_starAria', { count: n })}
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
              <div className="space-y-1.5">
                <Label htmlFor="comment" className={PARTNER_FIELD_LABEL_CLASS}>
                  {t('partnerGuestReview_commentLabel')}
                </Label>
                <Textarea
                  id="comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="min-h-[120px]"
                  placeholder={t('partnerGuestReview_commentPlaceholder')}
                  maxLength={4000}
                />
              </div>
              <Button
                type="submit"
                variant="brand"
                className="min-h-[44px] w-full"
                disabled={submitting || rating < 1}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('partnerGuestReview_submitting')}
                  </>
                ) : (
                  t('partnerGuestReview_submit')
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
