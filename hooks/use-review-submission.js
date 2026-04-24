'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { getUIText } from '@/lib/translations'
import { postRenterReview } from '@/lib/reviews/post-renter-review'
import { processAndUploadReviewPhotos } from '@/lib/services/image-upload.service'

/**
 * Stage 28.0 — единая отправка отзыва гостя (фото + POST). Без TanStack Query внутри:
 * передайте `onSuccess` для invalidate / refetch списка.
 *
 * @param {object} [opts]
 * @param {string} [opts.language]
 * @param {string | null} [opts.userId] — для загрузки фото
 * @param {() => void} [opts.onSuccess]
 */
export function useReviewSubmission(opts = {}) {
  const { language = 'ru', userId = null, onSuccess } = opts
  const [isPending, setIsPending] = useState(false)

  const submitReview = useCallback(
    async ({ booking, ratings, comment, photos = [], photoFiles = [] }) => {
      setIsPending(true)
      try {
        let uploaded = photos
        if (photoFiles.length > 0) {
          if (!userId || !booking?.id) {
            throw new Error(getUIText('reviewForm_toastSubmitFailed', language))
          }
          uploaded = await processAndUploadReviewPhotos(photoFiles, userId, booking.id)
          if (uploaded.length !== photoFiles.length) {
            throw new Error(getUIText('reviewForm_toastPhotoUpload', language))
          }
        }
        await postRenterReview({ booking, ratings, comment, photos: uploaded })
        toast.success(getUIText('renterReviewSuccess', language))
        onSuccess?.()
      } catch (e) {
        const msg = e?.message || getUIText('reviewForm_toastSubmitFailed', language)
        toast.error(msg)
        throw e
      } finally {
        setIsPending(false)
      }
    },
    [language, userId, onSuccess],
  )

  return { submitReview, isPending }
}
