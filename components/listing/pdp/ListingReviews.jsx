'use client'

/**
 * PDP reviews — Stage 201.83 placement; Stage 201.118 deferred hydrate.
 * Map already uses the same pattern in `pdp/ListingMap.jsx` (171.23).
 */

import dynamic from 'next/dynamic'
import { PdpDeferredSection } from '@/components/listing/pdp/PdpDeferredSection'
import { PDP_REVIEWS_FALLBACK_CLASS } from '@/lib/listing/pdp-hero-layout'
import { cn } from '@/lib/utils'

function ReviewsLoadFallback({ language = 'en' }) {
  return (
    <div
      className={cn(
        PDP_REVIEWS_FALLBACK_CLASS,
        'rounded-2xl border border-slate-100 bg-slate-50 p-4',
      )}
      aria-busy="true"
      aria-label={language === 'ru' ? 'Загрузка отзывов' : 'Loading reviews'}
      data-testid="pdp-reviews-fallback"
    >
      <div className="mb-3 h-7 w-40 rounded-lg bg-slate-200 gsl-shimmer" />
      <div className="mb-4 h-3 w-full max-w-md rounded bg-slate-200 gsl-shimmer" />
      <div className="space-y-3">
        <div className="h-20 rounded-xl bg-slate-200 gsl-shimmer" />
        <div className="h-20 rounded-xl bg-slate-200 gsl-shimmer" />
      </div>
    </div>
  )
}

const ReviewsSectionLazy = dynamic(
  () => import('@/components/listing/ReviewsSection').then((m) => m.ReviewsSection),
  {
    ssr: true,
    loading: () => <ReviewsLoadFallback />,
  },
)

export function ListingReviews({ listing, reviews, language = 'en' }) {
  return (
    <PdpDeferredSection fallback={<ReviewsLoadFallback language={language} />}>
      <ReviewsSectionLazy listing={listing} reviews={reviews} language={language} />
    </PdpDeferredSection>
  )
}
