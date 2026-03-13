'use client'

/**
 * ListingCardSkeleton - Loading placeholder for GostayloListingCard
 * 
 * Mimics exact layout of the card for smooth loading experience
 * 
 * @created 2026-03-13
 */

import { cn } from "@/lib/utils"

export function ListingCardSkeleton({ className }) {
  return (
    <div className={cn(
      "bg-white rounded-xl overflow-hidden border border-slate-100",
      className
    )}>
      {/* Image Skeleton */}
      <div className="aspect-[4/3] bg-slate-200 animate-pulse" />
      
      {/* Content Skeleton */}
      <div className="p-4 space-y-3">
        {/* Title Row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4" />
            <div className="h-3 bg-slate-100 rounded animate-pulse w-1/2" />
          </div>
          <div className="h-4 w-12 bg-slate-200 rounded animate-pulse" />
        </div>
        
        {/* Specs Row */}
        <div className="flex items-center gap-4">
          <div className="h-4 w-8 bg-slate-100 rounded animate-pulse" />
          <div className="h-4 w-8 bg-slate-100 rounded animate-pulse" />
          <div className="h-4 w-8 bg-slate-100 rounded animate-pulse" />
        </div>
        
        {/* Location */}
        <div className="h-3 bg-slate-100 rounded animate-pulse w-2/3" />
        
        {/* Divider */}
        <div className="border-t border-slate-100 my-2" />
        
        {/* Price Row */}
        <div className="flex items-end justify-between">
          <div className="space-y-1">
            <div className="h-6 w-24 bg-slate-200 rounded animate-pulse" />
            <div className="h-3 w-16 bg-slate-100 rounded animate-pulse" />
          </div>
          <div className="h-6 w-16 bg-slate-100 rounded-full animate-pulse" />
        </div>
        
        {/* Button */}
        <div className="h-10 bg-slate-200 rounded-lg animate-pulse mt-2" />
      </div>
    </div>
  )
}

/**
 * Grid of skeleton cards
 */
export function ListingGridSkeleton({ count = 8 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <ListingCardSkeleton key={i} />
      ))}
    </div>
  )
}

export default ListingCardSkeleton
