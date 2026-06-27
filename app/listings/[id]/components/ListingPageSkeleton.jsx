'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { GSL_SHIMMER } from '@/lib/theme/product-ui'
import { PDP_HERO_SECTION_MB, PDP_HERO_SKELETON_CLASS } from '@/lib/listing/pdp-hero-layout'

export function ListingPageSkeleton() {
  return (
    <div className={`min-h-screen bg-white ${GSL_SHIMMER}`} aria-busy aria-label="Loading">
      <div className="border-b border-slate-200 px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className={`${PDP_HERO_SECTION_MB} ${PDP_HERO_SKELETON_CLASS}`} />
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}
