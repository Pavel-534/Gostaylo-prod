/**
 * GoStayLo - Review Submission Modal (Phase 4 + Stage 26.0 i18n)
 */

'use client'

import { useState, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Star, X, Loader2, CheckCircle, ImagePlus } from 'lucide-react'
import { toast } from 'sonner'
import { processAndUploadReviewPhotos } from '@/lib/services/image-upload.service'
import { getUIText } from '@/lib/translations'
import { getReviewCriteriaRows } from '@/lib/config/review-criteria-labels'

function StarRating({ value, onChange, label }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="text-sm text-slate-500">{value || 0}/5</span>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="transition-transform hover:scale-110 focus:outline-none"
          >
            <Star
              className={`h-8 w-8 transition-colors ${
                star <= (value || 0) ? 'fill-teal-600 text-teal-600' : 'text-slate-300 hover:text-slate-400'
              }`}
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

  if (!isOpen) return null

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
      await onSubmit({ ratings, comment, photos })
      setSubmitSuccess(true)
      setTimeout(() => {
        onClose()
        setSubmitSuccess(false)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {submitSuccess ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-teal-100">
              <CheckCircle className="h-10 w-10 text-teal-600" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-slate-900">{tx('reviewForm_successTitle')}</h2>
            <p className="text-slate-600">{tx('reviewForm_successBody')}</p>
          </div>
        ) : (
          <>
            <div className="border-b border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{tx('reviewForm_title')}</h2>
                  <p className="mt-1 text-slate-600">{listingForCat.title || '—'}</p>
                  <p className="mt-2 text-sm text-slate-700">{tx('reviewForm_intro')}</p>
                </div>
                <button type="button" onClick={onClose} className="text-slate-400 transition-colors hover:text-slate-600">
                  <X className="h-6 w-6" />
                </button>
              </div>

              {averageRating > 0 && (
                <div className="mt-4 flex items-center gap-3 rounded-lg bg-teal-50 p-4">
                  <div className="text-3xl font-bold text-teal-600">{averageRating.toFixed(1)}</div>
                  <div className="flex-1">
                    <div className="mb-1 flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-5 w-5 ${
                            star <= Math.round(averageRating) ? 'fill-teal-600 text-teal-600' : 'text-slate-300'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-slate-600">{tx('reviewForm_overall')}</p>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 p-6">
              <div className="space-y-4">
                <h3 className="mb-3 font-semibold text-slate-900">{tx('reviewForm_rateExperience')}</h3>

                {ratingRows.map(({ key, icon, label }) => (
                  <div key={key} className="rounded-lg bg-slate-50 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="text-2xl">{icon}</span>
                      <span className="font-medium text-slate-900">{label}</span>
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
                <label className="mb-2 block text-sm font-medium text-slate-700">{tx('reviewForm_commentLabel')}</label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={tx('reviewForm_commentPlaceholder')}
                  rows={4}
                  className="resize-none"
                  maxLength={1000}
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
                    size="sm"
                    disabled={photoFiles.length >= MAX_REVIEW_PHOTOS}
                    onClick={() => photoInputRef.current?.click()}
                  >
                    <ImagePlus className="mr-1 inline h-4 w-4" />
                    {tx('reviewForm_addPhotos')}
                  </Button>
                  {photoFiles.length > 0 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setPhotoFiles([])}>
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
                <p className="text-sm text-slate-600">{tx('reviewForm_privacy')}</p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={onClose} className="flex-1" disabled={isSubmitting}>
                  {tx('reviewForm_cancel')}
                </Button>
                <Button type="submit" className="flex-1 bg-teal-600 hover:bg-teal-700" disabled={isSubmitting}>
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
      </div>
    </div>
  )
}
