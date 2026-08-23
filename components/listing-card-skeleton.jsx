'use client'

/**
 * ListingCardSkeleton — loading placeholder aligned with ListingCard layout SSOT
 * (Stage 200.114 — BODY_PAD + LISTING_CARD_MEDIA_ASPECT to avoid CLS).
 */

import { cn } from "@/lib/utils"
import {
  LISTING_CARD_BODY_PAD,
  LISTING_CARD_CONTENT_MIN_H,
  LISTING_CARD_CONTENT_VISIBILITY_CLASS,
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
 * Shimmer block — uses design-system `.gsl-shimmer` (globals.css).
 */
function Shimmer({ className }) {
  return (
    <div
      className={cn('gsl-shimmer bg-slate-200', className)}
    />
  )
}

/**
 * Match ListingCard chrome:
 * - `rounded-2xl` + `border-slate-200`
 * - Media: `LISTING_CARD_MEDIA_ASPECT` (5/4 mobile, 4/3 sm+)
 * - Body: `LISTING_CARD_BODY_PAD` (`p-3 sm:p-4`)
 */
export function ListingCardSkeleton({ className, style }) {
  return (
    <div
      style={style}
      className={cn(
        "h-full flex flex-col bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm",
        LISTING_CARD_CONTENT_VISIBILITY_CLASS,
        className,
      )}
      data-testid="listing-card-skeleton"
    >
      <Shimmer className={cn("flex-shrink-0", LISTING_CARD_MEDIA_ASPECT)} />

      <div className={cn("flex flex-col flex-grow gap-3", LISTING_CARD_BODY_PAD, LISTING_CARD_CONTENT_MIN_H)}>
        <Shimmer className={cn("h-[18px] rounded w-3/4", LISTING_CARD_TITLE_ROW_MIN_H)} />

        <div className={LISTING_CARD_TRUST_ROW_MIN_H}>
          <Shimmer className="h-3 rounded w-1/2 bg-slate-100" />
        </div>

        <div className={cn("flex items-center gap-3", LISTING_CARD_SPEC_ROW_MIN_H)}>
          <Shimmer className="h-3 w-8 rounded bg-slate-100" />
          <Shimmer className="h-3 w-8 rounded bg-slate-100" />
          <Shimmer className="h-3 w-8 rounded bg-slate-100" />
        </div>

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
