'use client'

import { Children, forwardRef } from 'react'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import { cn } from '@/lib/utils'

export const RecommendationRailShell = forwardRef(function RecommendationRailShell(
  { title, children, className },
  ref,
) {
  const slides = Children.toArray(children)

  return (
    <section ref={ref} className={cn('space-y-4', className)}>
      <Carousel
        opts={{
          align: 'start',
          dragFree: true,
          containScroll: 'trimSnaps',
        }}
        className="w-full"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          {slides.length > 1 ? (
            <div className="flex shrink-0 items-center gap-1">
              <CarouselPrevious
                variant="outline"
                size="icon"
                className="relative static inset-auto h-9 w-9 translate-x-0 translate-y-0 rounded-full border-slate-200 bg-white shadow-sm hover:bg-slate-50 disabled:opacity-30"
              />
              <CarouselNext
                variant="outline"
                size="icon"
                className="relative static inset-auto h-9 w-9 translate-x-0 translate-y-0 rounded-full border-slate-200 bg-white shadow-sm hover:bg-slate-50 disabled:opacity-30"
              />
            </div>
          ) : null}
        </div>

        <CarouselContent className="-ml-4 mt-4">
          {slides.map((child) => (
            <CarouselItem key={child.key} className="basis-auto pl-4">
              {child}
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </section>
  )
})

RecommendationRailShell.displayName = 'RecommendationRailShell'
