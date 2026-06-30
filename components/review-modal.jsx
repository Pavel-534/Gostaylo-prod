/**
 * Review submission modal (Phase 4 + Stage 26.0 i18n, Stage 176.2 mobile UX)
 */

'use client'

import { useState, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Star, X, Loader2, CheckCircle, ImagePlus } from 'lucide-react'
import { toast } from 'sonner'
import { processAndUploadReviewPhotos } from '@/lib/services/image-upload.service'
import { getUIText } from '@/lib/translations'
import { getReviewCriteriaRows } from '@/lib/config/review-criteria-labels'
import { cn } from '@/lib/utils'

function StarRating({ value, onChange, label }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 break-words text-sm font-medium text-slate-700">{label}</span>
        <span className="shrink-0 text-sm text-slate-500">{value || 0}/5</span>
      </div>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg transition-transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            aria-label={`${star}`}
          >
            <Star
              className={cn(
                'h-7 w-7 transition-colors',
                star <= (value || 0) ? 'fill-brand text-brand' : 'text-slate-300 hover:text-slate-400',
              )}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

const MAX_REVIEW_PHOTOS = 5

export function ReviewModal({
  isOpen,
  onClose,
  booking,
  userId,
  onSubmit,
  isSubmitting,
  language = 'ru',
  /** @deprecated alias — prefer categorySlug */
  category_slug,
  categorySlug: categorySlugProp,
}) {
  const tx = (key) => getUIText(key, language)
  const [ratings, setRatings] = useState({
    cleanliness: 0,
    accuracy: 0,
    communication: 0,
    location: 0,
    value: 0,
  })
  const [comment, setComment] = useState('')
  const [photoFiles, setPhotoFiles] = useState([])
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitPendingModeration, setSubmitPendingModeration] = useState(false)
  const photoInputRef = useRef(null)

  const listingForCat = booking?.listing || booking?.listings || {}
  const categorySlug =
    categorySlugProp ?? category_slug ?? listingForCat.category_slug ?? listingForCat.categorySlug ?? null

  const ratingRows = useMemo(
    () =>
      getReviewCriteriaRows(categorySlug, language, (dimKey) =>
        getUIText(`reviewForm_dim_${dimKey}`, language),
      ),
    [categorySlug, language],
  )

  const handleRatingChange = (category, value) => {
    setRatings((prev) => ({ ...prev, [category]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const allRated = Object.values(ratings).every((r) => r > 0)
    if (!allRated) {
      toast.error(tx('reviewForm_toastAllRated'))
      return
    }

    try {
      let photos = []
      if (photoFiles.length > 0 && userId && booking?.id) {
        photos = await processAndUploadReviewPhotos(photoFiles, userId, booking.id)
        if (photos.length !== photoFiles.length) {
          toast.error(tx('reviewForm_toastPhotoUpload'))
          return
        }
      }
      const result = await onSubmit({ ratings, comment, photos })
      setSubmitPendingModeration(result?.moderationPending === true)
      setSubmitSuccess(true)
      setTimeout(() => {
        onClose()
        setSubmitSuccess(false)
        setSubmitPendingModeration(false)
        setRatings({ cleanliness: 0, accuracy: 0, communication: 0, location: 0, value: 0 })
        setComment('')
        setPhotoFiles([])
      }, 2000)
    } catch {
      toast.error(tx('reviewForm_toastSubmitFailed'))
    }
  }

  function onPickPhotos(e) {
    const picked = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'))
    if (!picked.length) return
    setPhotoFiles((prev) => {
      const next = [...prev, ...picked].slice(0, MAX_REVIEW_PHOTOS)
      if (prev.length + picked.length > MAX_REVIEW_PHOTOS) {
        toast.error(tx('reviewForm_toastMaxPhotos').replace('{{max}}', String(MAX_REVIEW_PHOTOS)))
      }
      return next
    })
    e.target.value = ''
  }

  const averageRating = Object.values(ratings).reduce((sum, r) => sum + r, 0) / 5

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className={cn(
          'gap-0 overflow-hidden p-0',
          'bottom-0 top-auto max-h-[min(92dvh,calc(100dvh-0.5rem))] translate-y-0 rounded-t-2xl rounded-b-none border-b-0',
          'sm:bottom-auto sm:top-[50%] sm:max-h-none sm:translate-y-[-50%] sm:rounded-lg sm:border-b',
          'w-full max-w-2xl',
        )}
      >
        {submitSuccess ? (
          <div className="p-8 text-center sm:p-12">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-brand/15">
              <CheckCircle className="h-10 w-10 text-brand" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-slate-900">{tx('reviewForm_successTitle')}</h2>
            <p className="text-slate-600">
              {submitPendingModeration
                ? tx('reviewForm_successBodyModerationPending')
                : tx('reviewForm_successBody')}
            </p>
          </div>
        ) : (
          <>
            <div className="shrink-0 border-b border-slate-200 px-4 pb-3 pt-5 sm:px-6">
              <DialogHeader className="space-y-0 p-0 text-left">
                <div className="flex items-start justify-between gap-3 pr-2">
                  <div className="min-w-0 flex-1">
                    <DialogTitle className="text-xl font-bold text-slate-900 sm:text-2xl">
                      {tx('reviewForm_title')}
                    </DialogTitle>
                    <DialogDescription className="mt-1 line-clamp-2 text-slate-600">
                      {listingForCat.title || '—'}
                    </DialogDescription>
                    <p className="mt-2 text-sm text-slate-700">{tx('reviewForm_intro')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    aria-label={tx('reviewForm_cancel')}
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </DialogHeader>

              {averageRating > 0 && (
                <div className="mt-4 flex items-center gap-3 rounded-lg bg-brand/10 p-4">
                  <div className="text-3xl font-bold text-brand">{averageRating.toFixed(1)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={cn(
                            'h-5 w-5',
                            star <= Math.round(averageRating) ? 'fill-brand text-brand' : 'text-slate-300',
                          )}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-slate-600">{tx('reviewForm_overall')}</p>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
                <div className="space-y-4">
                  <h3 className="mb-3 font-semibold text-slate-900">{tx('reviewForm_rateExperience')}</h3>

                  {ratingRows.map(({ key, icon, label }) => (
                    <div key={key} className="rounded-lg bg-slate-50 p-4">
                      <div className="mb-3 flex items-start gap-2">
                        <span className="shrink-0 text-2xl">{icon}</span>
                        <span className="min-w-0 break-words font-medium text-slate-900">{label}</span>
                      </div>
                      <StarRating
                        value={ratings[key]}
                        onChange={(value) => handleRatingChange(key, value)}
                        label=""
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    {tx('reviewForm_commentLabel')}
                  </label>
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={tx('reviewForm_commentPlaceholder')}
                    rows={4}
                    className="min-h-[48px] resize-none"
                    maxLength={1000}
                    onFocus={(e) => {
                      e.target.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
                    }}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    {comment.length}/1000 {getUIText('characters', language)}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">
                    {tx('reviewForm_photosLabel').replace('{{max}}', String(MAX_REVIEW_PHOTOS))}
                  </Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      onChange={onPickPhotos}
                      disabled={photoFiles.length >= MAX_REVIEW_PHOTOS}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={photoFiles.length >= MAX_REVIEW_PHOTOS}
                      className="min-h-[44px]"
                      onClick={() => photoInputRef.current?.click()}
                    >
                      <ImagePlus className="mr-1 inline h-4 w-4" />
                      {tx('reviewForm_addPhotos')}
                    </Button>
                    {photoFiles.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-[44px]"
                        onClick={() => setPhotoFiles([])}
                      >
                        {tx('reviewForm_clearPhotos')}
                      </Button>
                    )}
                  </div>
                  {photoFiles.length > 0 && (
                    <p className="text-xs text-slate-500">
                      {tx('reviewForm_selectedCount').replace('{{n}}', String(photoFiles.length))}
                    </p>
                  )}
                </div>

                <div className="rounded-lg bg-slate-50 p-4">
                  <p className="break-words text-sm text-slate-600">{tx('reviewForm_privacy')}</p>
                </div>
              </div>

              <div className="sticky bottom-0 flex gap-3 border-t border-slate-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="min-h-[48px] flex-1"
                  disabled={isSubmitting}
                >
                  {tx('reviewForm_cancel')}
                </Button>
                <Button type="submit" variant="brand" className="min-h-[48px] flex-1" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {tx('reviewForm_submitting')}
                    </>
                  ) : (
                    tx('reviewForm_submit')
                  )}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
