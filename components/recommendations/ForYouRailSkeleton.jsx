'use client'

import { cn } from '@/lib/utils'
import { RECOMMENDATION_RAIL_CARD_CLASS } from '@/lib/recommendations/constants'

/** Stage 201.114a — chunk-load placeholder; mirrors `ForYouRail` data-loading shimmer. */
export function ForYouRailSkeleton({ className }) {
  return (
    <section
      className={cn('space-y-4', className)}
      aria-busy="true"
      data-testid="for-you-rail-skeleton"
    >
      <div className="h-7 w-48 max-w-[60%] rounded bg-slate-200 gsl-shimmer" />
      <div className="flex gap-3 overflow-hidden">
        {[0, 1].map((i) => (
          <div
            key={i}
            className={cn(
              RECOMMENDATION_RAIL_CARD_CLASS,
              'overflow-hidden rounded-xl border border-slate-200/80 bg-white',
            )}
          >
            <div className="aspect-[4/3] bg-slate-200 gsl-shimmer" />
            <div className="space-y-2 p-2.5">
              <div className="h-4 w-3/4 rounded bg-slate-200 gsl-shimmer" />
              <div className="h-3 w-1/2 rounded bg-slate-200 gsl-shimmer" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
