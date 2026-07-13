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
import {
  LISTING_CARD_CONTENT_MIN_H,
  LISTING_CARD_MEDIA_ASPECT,
  LISTING_CARD_PRICE_ROW_MIN_H,
  LISTING_CARD_SPEC_ROW_MIN_H,
  LISTING_CARD_TITLE_ROW_MIN_H,
  LISTING_CARD_TRUST_ROW_MIN_H,
  LISTING_CATALOG_GRID_CLASSES,
  MOBILE_CATALOG_SKELETON_COUNT,
  DESKTOP_CATALOG_SKELETON_COUNT,
} from '@/lib/listing/listing-card-layout'

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
 * - Image: `aspect-[4/3]` (SSOT с реальной карточкой), без фиксированной высоты.
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
      {/* Image — тот же aspect-ratio, что у реальной карточки */}
      <Shimmer className={cn("flex-shrink-0", LISTING_CARD_MEDIA_ASPECT)} />

      {/* Content — p-5, как реальная */}
      <div className={cn("flex flex-col flex-grow p-5 gap-3", LISTING_CARD_CONTENT_MIN_H)}>
        {/* Title 18px */}
        <Shimmer className={cn("h-[18px] rounded w-3/4", LISTING_CARD_TITLE_ROW_MIN_H)} />

        {/* Location row */}
        <div className={LISTING_CARD_TRUST_ROW_MIN_H}>
          <Shimmer className="h-3 rounded w-1/2 bg-slate-100" />
        </div>

        {/* Specs row */}
        <div className={cn("flex items-center gap-3", LISTING_CARD_SPEC_ROW_MIN_H)}>
          <Shimmer className="h-3 w-8 rounded bg-slate-100" />
          <Shimmer className="h-3 w-8 rounded bg-slate-100" />
          <Shimmer className="h-3 w-8 rounded bg-slate-100" />
        </div>

        {/* Price row — pinned to bottom (mt-auto), как реальная */}
        <div className={cn("mt-auto flex items-baseline justify-between", LISTING_CARD_PRICE_ROW_MIN_H)}>
          <Shimmer className="h-7 w-28 rounded" />
          <Shimmer className="h-4 w-12 rounded bg-slate-100" />
        </div>
      </div>
    </div>
  )
}

/**
 * Grid of skeleton cards — SSOT with catalog listing grid (same gap / columns → no CLS).
 * @param {{ count?: number, mobile?: boolean }} props
 */
export function ListingGridSkeleton({ count, mobile = false }) {
  const resolvedCount =
    count ?? (mobile ? MOBILE_CATALOG_SKELETON_COUNT : DESKTOP_CATALOG_SKELETON_COUNT)
  return (
    <div className={LISTING_CATALOG_GRID_CLASSES} data-testid="listing-grid-skeleton">
      {Array.from({ length: resolvedCount }).map((_, i) => (
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
