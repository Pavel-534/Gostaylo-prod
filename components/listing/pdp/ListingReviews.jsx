'use client'

import nextDynamic from 'next/dynamic'

const ReviewsSectionLazy = nextDynamic(
  () =>
    import('@/components/listing/ReviewsSection').then((mod) => ({
      default: mod.ReviewsSection,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl border border-slate-100 bg-slate-50 h-40 animate-pulse" aria-hidden />
    ),
  },
)

export function ListingReviews(props) {
  return <ReviewsSectionLazy {...props} />
}
