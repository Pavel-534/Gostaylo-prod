'use client'

import { BadgeCheck, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getUIText } from '@/lib/translations'
import { getRenterTrustBadgeKinds } from '@/lib/trust/renter-trust-badges'

/**
 * Compact renter-facing trust badges (listing card, order card).
 * @param {{ trust: object | null, language?: string, className?: string }} props
 */
export function PartnerRenterTrustBadges({ trust, language = 'ru', className }) {
  const kinds = getRenterTrustBadgeKinds(trust)
  if (!kinds.length) return null

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {kinds.includes('lightning_response') ? (
        <Badge
          variant="secondary"
          className="gap-0.5 h-5 sm:h-6 px-1.5 py-0 text-[10px] sm:text-xs font-semibold border-amber-200 bg-amber-50 text-amber-950"
        >
          <Zap className="h-3 w-3 shrink-0" aria-hidden />
          {getUIText('trustBadge_lightningResponse', language)}
        </Badge>
      ) : null}
      {kinds.includes('ultra_reliable') ? (
        <Badge
          variant="secondary"
          className="gap-0.5 h-5 sm:h-6 px-1.5 py-0 text-[10px] sm:text-xs font-semibold border-indigo-200 bg-indigo-50 text-indigo-950"
        >
          <BadgeCheck className="h-3 w-3 shrink-0" aria-hidden />
          {getUIText('trustBadge_ultraReliable', language)}
        </Badge>
      ) : null}
    </div>
  )
}
