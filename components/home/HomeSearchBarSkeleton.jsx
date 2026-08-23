'use client'

import { cn } from '@/lib/utils'

/**
 * Stage 201.114a / 201.116 — fixed-height placeholders for lazy `UnifiedSearchBar`
 * (home + catalog). Hero fields: 60px (ADR-101). Compact: ~44px row + py-2.5.
 * Filter: catalog expanded FilterBar field row (min-h-11).
 */
export function HomeSearchBarSkeleton({ variant = 'hero', className }) {
  if (variant === 'compact') {
    return (
      <div
        className={cn('container mx-auto px-4 py-2.5', className)}
        aria-hidden
        data-testid="home-search-bar-skeleton-compact"
      >
        <div className="flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm">
          <div className="hidden h-9 min-w-[100px] flex-1 rounded-lg bg-slate-200 gsl-shimmer md:block" />
          <div className="h-9 min-w-0 flex-[2] rounded-lg bg-slate-200 gsl-shimmer" />
          <div className="h-9 min-w-0 flex-[2] rounded-lg bg-slate-200 gsl-shimmer" />
          <div className="h-9 w-24 shrink-0 rounded-lg bg-slate-200 gsl-shimmer" />
          <div className="h-9 w-20 shrink-0 rounded-2xl bg-brand/15 gsl-shimmer" />
        </div>
      </div>
    )
  }

  if (variant === 'filter') {
    return (
      <div
        className={cn('border-b border-slate-200 bg-white', className)}
        aria-hidden
        data-testid="home-search-bar-skeleton-filter"
      >
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-stretch md:gap-3">
            <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="h-11 min-h-11 rounded-xl border border-slate-200 bg-slate-200 gsl-shimmer" />
              <div className="h-11 min-h-11 rounded-xl border border-slate-200 bg-slate-200 gsl-shimmer" />
              <div className="h-11 min-h-11 rounded-xl border border-slate-200 bg-slate-200 gsl-shimmer" />
              <div className="h-11 min-h-11 rounded-xl border border-slate-200 bg-slate-200 gsl-shimmer" />
            </div>
            <div className="h-9 min-h-[36px] w-full shrink-0 rounded-md border border-slate-200 bg-slate-200 gsl-shimmer md:w-28 md:self-stretch" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn('min-w-0', className)}
      aria-hidden
      data-testid="home-search-bar-skeleton-hero"
    >
      <div className="grid grid-cols-1 items-stretch gap-2 md:grid-cols-[minmax(190px,1.4fr)_minmax(170px,1.2fr)_minmax(170px,0.95fr)_minmax(132px,0.72fr)] xl:grid-cols-[minmax(240px,1.5fr)_minmax(220px,1.3fr)_220px_148px]">
        <div className="h-[60px] min-h-[60px] max-h-[60px] rounded-2xl border border-slate-200 bg-slate-200 gsl-shimmer" />
        <div className="h-[60px] min-h-[60px] max-h-[60px] rounded-2xl border border-slate-200 bg-slate-200 gsl-shimmer" />
        <div className="h-[60px] min-h-[60px] max-h-[60px] rounded-2xl border border-slate-200 bg-slate-200 gsl-shimmer" />
        <div className="h-[60px] min-h-[60px] max-h-[60px] rounded-2xl bg-brand/15 gsl-shimmer" />
      </div>
    </div>
  )
}
