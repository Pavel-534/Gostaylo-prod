'use client'

import { cn } from '@/lib/utils'

export function RecommendationRailShell({ title, children, className }) {
  return (
    <section className={cn('space-y-4', className)}>
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <div className="-mx-1 flex gap-4 overflow-x-auto pb-2 px-1 snap-x snap-mandatory scrollbar-thin">
        {children}
      </div>
    </section>
  )
}
