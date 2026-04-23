'use client'

import { Shimmer, ListingGridSkeleton } from '@/components/listing-card-skeleton'

/**
 * Mirrors catalog chrome: sticky header, filter block, list + map column.
 */
export function ListingsCatalogSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white shadow-sm sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Shimmer className="h-6 w-28 rounded" />
          <div className="flex items-center gap-2">
            <Shimmer className="h-8 w-8 rounded-lg" />
            <Shimmer className="h-6 w-20 rounded hidden sm:block" />
          </div>
          <Shimmer className="h-7 w-10 rounded-full" />
        </div>
      </div>
      <div className="bg-white border-b border-slate-100">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-wrap gap-2 mb-3">
            <Shimmer className="h-10 w-full sm:w-40 rounded-lg" />
            <Shimmer className="h-10 w-full sm:w-32 rounded-lg" />
            <Shimmer className="h-10 flex-1 min-w-[8rem] rounded-lg" />
          </div>
          <Shimmer className="h-9 w-full max-w-xl rounded-lg" />
        </div>
      </div>
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row lg:items-stretch gap-6">
          <div className="w-full min-w-0 lg:w-[60%]">
            <ListingGridSkeleton count={6} />
          </div>
          <div className="hidden lg:block w-full lg:w-[40%] min-h-[360px]">
            <Shimmer className="h-full min-h-[360px] rounded-2xl w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
