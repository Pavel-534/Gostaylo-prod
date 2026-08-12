'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Star, MessageSquare, CheckCircle2, Loader2, Reply } from 'lucide-react'
import { toast } from 'sonner'
import { ReviewPhotosGallery } from '@/components/review-photos-gallery'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
  MOBILE_FLAT_EMPTY_CLASS,
} from '@/lib/ui/mobile-flat-canvas'
import { PartnerSectionDivider } from '@/components/partner/PartnerSectionDivider'
import {
  PARTNER_HUB_LIST_CARD_SURFACE_CLASS,
  PARTNER_SECTION_TITLE_CLASS,
} from '@/lib/ui/partner-section-rhythm'

// Star rating display
function StarRating({ rating }) {
  return (
    <div className='flex items-center gap-0.5'>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${
            star <= rating
              ? 'fill-amber-400 text-amber-400'
              : 'fill-slate-200 text-slate-200'
          }`}
        />
      ))}
    </div>
  )
}

export default function PartnerReviewsPage() {
  const router = useRouter()
  const { language } = useI18n()
  const [reviews, setReviews] = useState([])
  const [stats, setStats] = useState({ total: 0, averageRating: 0 })
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  
  // Reply state
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [submittingReply, setSubmittingReply] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('gostaylo_user')
    if (stored) {
      const parsed = JSON.parse(stored)
      setUser(parsed)
      loadReviews(parsed.id)
    }
  }, [])

  async function loadReviews(partnerId) {
    try {
      const res = await fetch(`/api/v2/reviews?partner_id=${partnerId}`)
      const data = await res.json()
      
      if (data.success) {
        setReviews(data.data.reviews)
        setStats(data.data.stats)
      }
    } catch (error) {
      console.error('Failed to load reviews:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmitReply() {
    if (!replyText.trim()) {
      toast.error(getUIText('partnerReviewReplyEmpty', language))
      return
    }

    setSubmittingReply(true)
    try {
      const res = await fetch(`/api/v2/reviews/${replyingTo}/reply`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reply: replyText.trim()
        })
      })

      const data = await res.json()
      
      if (data.success) {
        toast.success(getUIText('partnerReviewReplySuccess', language))
        setReplyingTo(null)
        setReplyText('')
        loadReviews(user.id) // Reload reviews
      } else {
        toast.error(data.error || getUIText('partnerReviewReplyError', language))
      }
    } catch (error) {
      toast.error(getUIText('partnerReviewReplySendError', language))
    } finally {
      setSubmittingReply(false)
    }
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className='mx-auto max-w-4xl space-y-0 max-sm:p-0 sm:p-6'>
      <div className='mb-4'>
        <h1 className='text-2xl font-bold text-slate-900'>
          {getUIText('partnerReviewsPageTitle', language)}
        </h1>
        <p className='mt-1 text-xs leading-relaxed text-slate-500'>
          {getUIText('partnerReviewsPageSubtitle', language)}
        </p>
      </div>

      <section data-partner-section='reviews-stats' className='space-y-3'>
        <h2 className={PARTNER_SECTION_TITLE_CLASS}>
          {getUIText('partnerReviews_sectionStats', language)}
        </h2>
        <div className='grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4'>
          <Card className={cn(MOBILE_FLAT_CARD_CLASS, PARTNER_HUB_LIST_CARD_SURFACE_CLASS)}>
            <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'sm:pt-6')}>
              <div className='text-center'>
                <p className='text-3xl font-bold tabular-nums text-slate-900'>{stats.total}</p>
                <p className='text-xs text-slate-500'>{getUIText('partnerReviewsStatTotal', language)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className={cn(MOBILE_FLAT_CARD_CLASS, PARTNER_HUB_LIST_CARD_SURFACE_CLASS)}>
            <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'sm:pt-6')}>
              <div className='text-center'>
                <div className='flex items-center justify-center gap-2'>
                  <p className='text-3xl font-bold tabular-nums text-amber-500'>
                    {stats.averageRating.toFixed(1)}
                  </p>
                  <Star className='h-6 w-6 fill-amber-400 text-amber-400' />
                </div>
                <p className='text-xs text-slate-500'>{getUIText('partnerReviewsStatAvg', language)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className={cn(MOBILE_FLAT_CARD_CLASS, PARTNER_HUB_LIST_CARD_SURFACE_CLASS)}>
            <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'sm:pt-6')}>
              <div className='text-center'>
                <p className='text-3xl font-bold tabular-nums text-brand'>
                  {reviews.filter((r) => !r.partnerReply).length}
                </p>
                <p className='text-xs text-slate-500'>
                  {getUIText('partnerReviewsStatUnanswered', language)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <PartnerSectionDivider />

      <section data-partner-section='reviews-list' className='space-y-3'>
        <h2 className={PARTNER_SECTION_TITLE_CLASS}>
          {getUIText('partnerReviews_sectionList', language)}
        </h2>
        {loading ? (
          <div className='py-12 text-center text-slate-500'>
            <Loader2 className='mx-auto mb-2 h-8 w-8 animate-spin' />
            {getUIText('partnerReviewsLoading', language)}
          </div>
        ) : reviews.length === 0 ? (
          <Card className={cn(MOBILE_FLAT_CARD_CLASS, PARTNER_HUB_LIST_CARD_SURFACE_CLASS)}>
            <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, MOBILE_FLAT_EMPTY_CLASS)}>
              <Star className='mx-auto mb-4 h-12 w-12 text-slate-300' />
              <p className='text-slate-500'>{getUIText('partnerReviewsEmpty', language)}</p>
              <p className='mt-1 text-xs text-slate-400'>
                {getUIText('partnerReviewsEmptyHint', language)}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className='space-y-3'>
            {reviews.map((review) => (
              <Card
                key={review.id}
                className={cn(MOBILE_FLAT_CARD_CLASS, PARTNER_HUB_LIST_CARD_SURFACE_CLASS)}
              >
                <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'max-sm:py-4 sm:pt-6')}>
                  <div className='flex items-start gap-4'>
                    <div className='flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-brand/15'>
                      <span className='text-lg font-semibold text-brand-hover'>
                        {review.reviewerInitial}
                      </span>
                    </div>

                    <div className='min-w-0 flex-1'>
                      <div className='flex flex-wrap items-start justify-between gap-2'>
                        <div>
                          <div className='flex items-center gap-2'>
                            <span className='font-medium text-slate-900'>{review.reviewerName}</span>
                            {review.isVerifiedBooking ? (
                              <Badge
                                variant='outline'
                                className='border-green-300 bg-green-50 text-xs text-green-700'
                              >
                                <CheckCircle2 className='mr-1 h-3 w-3' />
                                {getUIText('partnerReviewsVerified', language)}
                              </Badge>
                            ) : null}
                          </div>
                          <div className='mt-1 flex items-center gap-2'>
                            <StarRating rating={review.rating} />
                            <span className='text-xs text-slate-500'>
                              {formatDate(review.createdAt)}
                            </span>
                          </div>
                        </div>

                        {!review.partnerReply ? (
                          <Dialog
                            open={replyingTo === review.id}
                            onOpenChange={(open) => {
                              if (open) {
                                setReplyingTo(review.id)
                                setReplyText('')
                              } else {
                                setReplyingTo(null)
                              }
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button variant='outline' size='sm' className='min-h-[44px]'>
                                <Reply className='mr-1 h-4 w-4' />
                                {getUIText('partnerReviewReplyAction', language)}
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>
                                  {getUIText('partnerReviewReplyDialogTitle', language)}
                                </DialogTitle>
                              </DialogHeader>
                              <div className='py-4'>
                                <div className='mb-4 rounded-lg bg-slate-50 p-3'>
                                  <div className='mb-1 flex items-center gap-2'>
                                    <span className='text-sm font-medium'>{review.reviewerName}</span>
                                    <StarRating rating={review.rating} />
                                  </div>
                                  <p className='text-sm text-slate-600'>{review.comment}</p>
                                </div>
                                <Textarea
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  placeholder={getUIText('partnerReviewReplyPlaceholder', language)}
                                  rows={4}
                                />
                              </div>
                              <DialogFooter>
                                <Button
                                  variant='outline'
                                  className='min-h-[44px]'
                                  onClick={() => setReplyingTo(null)}
                                >
                                  {getUIText('renterProfileCancel', language)}
                                </Button>
                                <Button
                                  onClick={handleSubmitReply}
                                  disabled={submittingReply || !replyText.trim()}
                                  variant='brand'
                                  className='min-h-[44px]'
                                >
                                  {submittingReply ? (
                                    <>
                                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                      {getUIText('partnerReviewSendingShort', language)}
                                    </>
                                  ) : (
                                    getUIText('partnerReviewReplySubmit', language)
                                  )}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        ) : null}
                      </div>

                      {review.comment ? (
                        <p className='mt-3 text-slate-700'>{review.comment}</p>
                      ) : null}
                      <ReviewPhotosGallery photos={review.photos} className='mt-3' />

                      {review.partnerReply ? (
                        <div className='mt-4 rounded-r-lg border-l-2 border-brand/20 bg-brand/5 py-3 pl-4 pr-3'>
                          <div className='mb-1 flex items-center gap-2'>
                            <MessageSquare className='h-4 w-4 text-brand' />
                            <span className='text-sm font-medium text-brand-hover'>
                              {getUIText('partnerReviewYourReply', language)}
                            </span>
                            <span className='text-xs text-slate-500'>
                              {review.partnerReplyAt ? formatDate(review.partnerReplyAt) : null}
                            </span>
                          </div>
                          <p className='text-sm text-slate-700'>{review.partnerReply}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
