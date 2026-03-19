/**
 * ReviewsSection Component
 * Displays ratings and review cards
 */

'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Star, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'

export function ReviewsSection({ listing, reviews, language = 'en' }) {
  const [showAll, setShowAll] = useState(false)

  // Defensive: API may return { reviews: [], stats: {} } or array directly
  const reviewsArray = Array.isArray(reviews) ? reviews : (reviews?.reviews ?? [])
  const visibleReviews = showAll ? reviewsArray : reviewsArray.slice(0, 3)

  return (
    <div id="reviews">
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
          
          {/* Individual Reviews */}
          {reviewsArray.length > 0 && (
            <div className="space-y-4 mt-6">
              {visibleReviews.map((review) => (
                <Card key={review.id} className="border-slate-200">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                        <User className="h-6 w-6 text-teal-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{review.reviewerName || review.reviewer_name || 'Guest'}</h4>
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                            <span className="text-sm">{review.rating}</span>
                          </div>
                        </div>
                        <p className="text-slate-600 text-sm leading-relaxed">
                          {review.comment}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {reviewsArray.length > 3 && (
                <div className="pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowAll(v => !v)}
                    className="border-teal-200 text-teal-700 hover:bg-teal-50"
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
