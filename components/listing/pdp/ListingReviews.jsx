'use client'

import { ReviewsSection } from '@/components/listing/ReviewsSection'

/** Eager (above-fold after Stage 191.0 reorder) — no lazy delay for review trust block. */
export function ListingReviews(props) {
  return <ReviewsSection {...props} />
}
