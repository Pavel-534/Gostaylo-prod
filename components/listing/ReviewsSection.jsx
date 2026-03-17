/**
 * ReviewsSection Component
 * Displays ratings and review cards
 */

'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Star, User } from 'lucide-react'

export function ReviewsSection({ listing, reviews, language = 'en' }) {
  return (
    <div>
      <h2 className="text-2xl font-medium tracking-tight mb-6">
        {language === 'ru' ? 'Отзывы' : 'Reviews'}
      </h2>
      
      {listing.reviewsCount > 0 ? (
        <div className="space-y-6">
          {/* Overall Rating */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
              <span className="text-3xl font-semibold">{listing.rating.toFixed(1)}</span>
            </div>
            <span className="text-slate-500">
              · {listing.reviewsCount} {language === 'ru' ? 'отзывов' : 'reviews'}
            </span>
          </div>
          
          {/* Individual Reviews */}
          {reviews.length > 0 && (
            <div className="space-y-4 mt-6">
              {reviews.slice(0, 3).map((review) => (
                <Card key={review.id} className="border-slate-200">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                        <User className="h-6 w-6 text-teal-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{review.reviewer_name}</h4>
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
