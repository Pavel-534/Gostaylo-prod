'use client'

import { Shimmer, ListingGridSkeleton } from '@/components/listing-card-skeleton'

/**
 * Layout-aligned shell for home while `GostayloHomeContent` hydrates / first paint.
 * Reduces full-screen spinner → hero-shaped placeholder.
 */
export function HomePageSkeleton() {
  return (
    <div className="min-h-screen bg-white">
      <section className="relative pt-14 min-h-[500px] sm:min-h-[580px] bg-slate-900">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 to-slate-800/60" />
        <div className="relative container mx-auto min-h-[440px] sm:min-h-[510px] px-3 sm:px-4 flex flex-col justify-center max-w-3xl">
          <Shimmer className="h-10 sm:h-14 rounded-lg w-4/5 max-w-xl mb-4" />
          <Shimmer className="h-6 sm:h-8 rounded w-full max-w-lg mb-8 bg-slate-700/50" />
          <div className="rounded-2xl border border-slate-600/50 bg-slate-800/40 p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Shimmer className="h-12 rounded-lg bg-slate-700/60" />
              <Shimmer className="h-12 rounded-lg bg-slate-700/60" />
              <Shimmer className="h-12 rounded-lg bg-slate-700/60" />
              <Shimmer className="h-12 rounded-lg bg-slate-700/60" />
            </div>
            <Shimmer className="h-14 rounded-xl w-full bg-slate-700/50" />
          </div>
        </div>
      </section>
      <section className="py-10 sm:py-14 bg-white">
        <div className="container mx-auto px-4">
          <Shimmer className="h-8 rounded w-48 mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Shimmer key={i} className="h-32 sm:h-40 rounded-xl" />
            ))}
          </div>
        </div>
      </section>
      <section className="py-10 sm:py-14 bg-slate-50" aria-hidden>
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-6 min-h-[3.5rem]">
            <div className="space-y-2 w-full max-w-sm">
              <Shimmer className="h-8 rounded w-56" />
              <Shimmer className="h-4 rounded w-40 bg-slate-200" />
            </div>
            <Shimmer className="h-5 w-5 rounded-full bg-slate-200 shrink-0" />
          </div>
          <div className="min-h-[520px] sm:min-h-[560px]">
            <ListingGridSkeleton count={8} />
          </div>
        </div>
      </section>
      <footer className="bg-slate-900 text-white py-10" aria-hidden>
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Shimmer className="h-4 w-24 bg-slate-600/80 rounded" />
                <Shimmer className="h-3 w-full max-w-[10rem] bg-slate-700/60 rounded" />
              </div>
            ))}
          </div>
          <Shimmer className="h-3 w-48 mx-auto mt-8 bg-slate-700/50 rounded" />
        </div>
      </footer>
    </div>
  )
}
