'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { GSL_SHIMMER } from '@/lib/theme/product-ui'

/** Stage 114.6 — skeleton для `/u/[id]` ambassador landing. */
export function AmbassadorLandingSkeleton() {
  return (
    <div className={`min-h-screen bg-brand-surface pb-16 ${GSL_SHIMMER}`} aria-busy aria-label="Loading">
      <Skeleton className="h-14 w-full rounded-none" />
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-8">
        <Skeleton className="h-64 sm:h-72 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </div>
  )
}
