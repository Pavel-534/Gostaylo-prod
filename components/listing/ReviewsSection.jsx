/**
 * ReviewsSection Component
 * Displays ratings, category score bars, and review cards (Stage 191.0).
 */

'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Star, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'
import { ReviewPhotosGallery } from '@/components/review-photos-gallery'
import {
  REVIEW_RATING_KEYS,
  getReviewCriteriaRows,
} from '@/lib/config/review-criteria-labels'
import { cn } from '@/lib/utils'

function formatReviewDate(iso, language) {
  if (!iso) return null
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    return d.toLocaleDateString(language === 'ru' ? 'ru-RU' : language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return null
  }
}

/**
 * Average category scores from review.ratings (1–5).
 * @param {object[]} reviewsArray
 * @returns {Record<string, number> | null}
 */
function averageCategoryScores(reviewsArray) {
  const sums = Object.fromEntries(REVIEW_RATING_KEYS.map((k) => [k, 0]))
  const counts = Object.fromEntries(REVIEW_RATING_KEYS.map((k) => [k, 0]))
  for (const review of reviewsArray || []) {
    const r = review?.ratings
    if (!r || typeof r !== 'object') continue
    for (const key of REVIEW_RATING_KEYS) {
      const n = Number(r[key])
      if (Number.isFinite(n) && n > 0) {
        sums[key] += n
        counts[key] += 1
      }
    }
  }
  const out = {}
  let any = false
  for (const key of REVIEW_RATING_KEYS) {
    if (counts[key] > 0) {
      out[key] = Math.round((sums[key] / counts[key]) * 10) / 10
      any = true
    }
  }
  return any ? out : null
}

export function ReviewsSection({ listing, reviews, language = 'en' }) {
  const [showAll, setShowAll] = useState(false)

  // Defensive: API may return { reviews: [], stats: {} } or array directly
  const reviewsArray = Array.isArray(reviews) ? reviews : (reviews?.reviews ?? [])
  const visibleReviews = showAll ? reviewsArray : reviewsArray.slice(0, 3)

  const categoryScores = useMemo(() => averageCategoryScores(reviewsArray), [reviewsArray])
  const criteriaRows = useMemo(
    () =>
      getReviewCriteriaRows(listing?.categorySlug || listing?.category?.slug, language, (k) =>
        getUIText(`reviewForm_dim_${k}`, language),
      ),
    [listing?.categorySlug, listing?.category?.slug, language],
  )

  return (
    <div id="reviews" data-testid="listing-reviews-section">
      <h2 className="text-2xl font-medium tracking-tight mb-6">
        {getUIText('reviews', language)}
      </h2>

      {listing.reviewsCount > 0 ? (
        <div className="space-y-6">
          {/* Overall Rating */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
              <span className="text-3xl font-semibold">{(Number(listing?.rating) || 0).toFixed(1)}</span>
            </div>
            <span className="text-slate-500">
              · {listing.reviewsCount} {language === 'ru' ? 'отзывов' : 'reviews'}
            </span>
          </div>

          {/* Category score bars (Airbnb-like) */}
          {categoryScores ? (
            <div
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
              data-testid="listing-review-category-scores"
            >
              {criteriaRows.map((row) => {
                const score = categoryScores[row.key]
                if (score == null) return null
                const pct = Math.max(0, Math.min(100, (score / 5) * 100))
                return (
                  <div key={row.key} className="flex items-center gap-3 min-w-0">
                    <span className="w-[42%] shrink-0 truncate text-sm text-slate-700" title={row.label}>
                      {row.label}
                    </span>
                    <div className="h-1.5 min-w-0 flex-1 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-slate-900"
                        style={{ width: `${pct}%` }}
                        aria-hidden
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-900">
                      {score.toFixed(1)}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : null}

          {/* Individual Reviews */}
          {reviewsArray.length > 0 && (
            <div className="space-y-4 mt-6">
              {visibleReviews.map((review) => {
                const stayDate =
                  formatReviewDate(review.bookingDates?.checkIn, language) ||
                  formatReviewDate(review.createdAt, language)
                return (
                  <Card key={review.id} className="border-slate-200">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-brand/15 flex items-center justify-center flex-shrink-0">
                          <User className="h-6 w-6 text-brand" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <h4 className="font-medium truncate">
                              {review.reviewerName || review.reviewer_name || 'Guest'}
                            </h4>
                            <div className="flex items-center gap-1 shrink-0">
                              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                              <span className="text-sm">{review.rating}</span>
                            </div>
                          </div>
                          {stayDate ? (
                            <p className="mb-2 text-xs text-slate-500">{stayDate}</p>
                          ) : null}
                          <p className="text-slate-600 text-sm leading-relaxed">
                            {review.comment}
                          </p>
                          <ReviewPhotosGallery
                            photos={review.photos}
                            className="mt-3"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}

              {reviewsArray.length > 3 && (
                <div className="pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowAll((v) => !v)}
                    className={cn('min-h-11 border-brand/25 text-brand-hover hover:bg-brand/10')}
                  >
                    {showAll
                      ? getUIText('hide', language)
                      : getUIText('showAllReviews', language)}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="text-slate-500">
          {language === 'ru' ? 'Пока нет отзывов' : 'No reviews yet'}
        </p>
      )}
    </div>
  )
}
