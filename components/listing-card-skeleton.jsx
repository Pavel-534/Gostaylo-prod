'use client'

/**
 * ListingCardSkeleton — premium loading placeholder for listing cards (ListingCard layout)
 * 
 * Features:
 * - Shimmer effect for premium feel
 * - Exact layout match with real card
 * - Smooth, eye-catching animation
 * 
 * @created 2026-03-13
 * @updated 2026-03-14 - Added shimmer effect
 */

import { cn } from "@/lib/utils"

/**
 * Shimmer component - reusable skeleton block with premium shine effect
 */
function Shimmer({ className }) {
  return (
    <div 
      className={cn(
        "relative overflow-hidden bg-slate-200 before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent",
        className
      )}
    />
  )
}

/**
 * Точное совпадение с `TopListingsGrid` карточкой:
 * - `rounded-2xl` + `border-slate-200` + такая же мягкая тень.
 * - Image: фиксированная `h-44 sm:h-48` (как реальная), не aspect-* — иначе layout shift при подмене.
 * - Content: `p-5`, ритм title (18px) → location → specs → price.
 */
export function ListingCardSkeleton({ className, style }) {
  return (
    <div
      style={style}
      className={cn(
        "h-full flex flex-col bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-[0_8px_18px_rgba(15,23,42,0.05),0_2px_6px_rgba(0,102,102,0.06)]",
        className,
      )}
    >
      {/* Image — те же h-44/h-48, что у реальной карточки */}
      <Shimmer className="h-44 sm:h-48 flex-shrink-0" />

      {/* Content — p-5, как реальная */}
      <div className="flex flex-col flex-grow p-5 gap-3">
        {/* Title 18px */}
        <Shimmer className="h-[18px] rounded w-3/4" />

        {/* Location row */}
        <Shimmer className="h-3 rounded w-1/2 bg-slate-100" />

        {/* Specs row */}
        <div className="flex items-center gap-3">
          <Shimmer className="h-3 w-8 rounded bg-slate-100" />
          <Shimmer className="h-3 w-8 rounded bg-slate-100" />
          <Shimmer className="h-3 w-8 rounded bg-slate-100" />
        </div>

        {/* Price row — pinned to bottom (mt-auto), как реальная */}
        <div className="mt-auto flex items-baseline justify-between">
          <Shimmer className="h-7 w-28 rounded" />
          <Shimmer className="h-4 w-12 rounded bg-slate-100" />
        </div>
      </div>
    </div>
  )
}

/**
 * Grid of skeleton cards — те же col-spans и `gap-8`, что в `TopListingsGrid`.
 */
export function ListingGridSkeleton({ count = 8 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
      {Array.from({ length: count }).map((_, i) => (
        <ListingCardSkeleton
          key={i}
          className="animate-fade-in"
          style={{ animationDelay: `${i * 50}ms` }}
        />
      ))}
    </div>
  )
}

/**
 * Reusable Shimmer block for other components
 */
export { Shimmer }

export default ListingCardSkeleton
