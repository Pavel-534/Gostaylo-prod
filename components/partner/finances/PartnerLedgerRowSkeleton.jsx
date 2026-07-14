'use client'

import { Skeleton } from '@/components/ui/skeleton'

export function PartnerLedgerRowSkeleton() {
  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2 gsl-shimmer"
      aria-hidden
    >
      <div className="flex justify-between gap-2">
        <Skeleton className="h-4 w-2/5 bg-slate-200/80" />
        <Skeleton className="h-3 w-16 bg-slate-200/80" />
      </div>
      <Skeleton className="h-3 w-3/4 bg-slate-200/80" />
      <Skeleton className="h-3 w-1/2 bg-slate-200/80" />
    </div>
  )
}

export function PartnerLedgerLoadMoreSkeleton({ count = 3 }) {
  return (
    <div className="space-y-3 min-w-0" aria-busy aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <PartnerLedgerRowSkeleton key={i} />
      ))}
    </div>
  )
}
