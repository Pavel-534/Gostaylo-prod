'use client'

/**
 * ListingCardSkeleton - Premium loading placeholder for GostayloListingCard
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

export function ListingCardSkeleton({ className }) {
  return (
    <div className={cn(
      "bg-white rounded-xl overflow-hidden border border-slate-100 shadow-sm",
      className
    )}>
      {/* Image Skeleton with Shimmer */}
      <Shimmer className="aspect-[4/3]" />
      
      {/* Content Skeleton */}
      <div className="p-4 space-y-3">
        {/* Title Row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 space-y-2">
            <Shimmer className="h-4 rounded w-3/4" />
            <Shimmer className="h-3 rounded w-1/2 bg-slate-100" />
          </div>
          <Shimmer className="h-4 w-12 rounded" />
        </div>
        
        {/* Specs Row */}
        <div className="flex items-center gap-4">
          <Shimmer className="h-4 w-10 rounded bg-slate-100" />
          <Shimmer className="h-4 w-10 rounded bg-slate-100" />
          <Shimmer className="h-4 w-10 rounded bg-slate-100" />
        </div>
        
        {/* Location */}
        <Shimmer className="h-3 rounded w-2/3 bg-slate-100" />
        
        {/* Divider */}
        <div className="border-t border-slate-100 my-2" />
        
        {/* Price Row */}
        <div className="flex items-end justify-between">
          <div className="space-y-1.5">
            <Shimmer className="h-6 w-28 rounded" />
            <Shimmer className="h-3 w-20 rounded bg-slate-100" />
          </div>
          <Shimmer className="h-7 w-20 rounded-full bg-slate-100" />
        </div>
        
        {/* Button */}
        <Shimmer className="h-10 rounded-lg mt-2" />
      </div>
    </div>
  )
}

/**
 * Grid of skeleton cards with staggered shimmer for premium feel
 */
export function ListingGridSkeleton({ count = 8 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <ListingCardSkeleton 
          key={i} 
          className={`animate-fade-in`}
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
