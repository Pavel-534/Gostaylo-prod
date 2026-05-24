'use client'

/**
 * Stage 87.0–87.1 — единый мини-бейдж «Verified» (каталог, карта, спека-ряд).
 * Логика: **`listingQualifiesForTrustVerifiedMiniBadge`** (**`lib/listing-card-spec-profile.js`**).
 */

import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUIText } from '@/lib/translations'
import { listingQualifiesForTrustVerifiedMiniBadge } from '@/lib/listing-card-spec-profile'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * @param {object} props
 * @param {Record<string, unknown> | null | undefined} props.listing
 * @param {string} [props.language]
 * @param {boolean} [props.compact]
 * @param {string} [props.className]
 */
export function ListingTrustVerifiedMiniBadge({
  listing,
  language = 'ru',
  compact = false,
  className,
}) {
  if (!listingQualifiesForTrustVerifiedMiniBadge(listing)) return null

  const iconCls = compact ? 'h-3 w-3 shrink-0 text-brand' : 'h-4 w-4 shrink-0 text-brand'
  const textCls = compact ? 'text-[10px] font-medium text-brand-hover' : 'text-xs font-medium text-brand-hover'
  const label = getUIText('partnerTrust_verified', language)
  const tooltip = getUIText('listingCard_verifiedPartner', language)

  const inner = (
    <span
      className={cn('inline-flex items-center gap-0.5 tabular-nums', textCls, className)}
      aria-label={tooltip}
    >
      <ShieldCheck className={iconCls} aria-hidden />
      {label}
    </span>
  )

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-help rounded outline-none focus-visible:ring-2 focus-visible:ring-brand">
            {inner}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
