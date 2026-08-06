'use client'

import { ShieldCheck } from 'lucide-react'
import { getUIText } from '@/lib/translations'
import { normalizeCancellationPolicy } from '@/lib/cancellation-refund-rules'
import { cn } from '@/lib/utils'
import { MOBILE_FLAT_INSET_CLASS } from '@/lib/ui/mobile-flat-canvas'

/**
 * Guest-facing cancellation copy (matches lib/cancellation-refund-rules.js tiers).
 */
export function ListingCancellationPolicy({ policy, language = 'ru' }) {
  const p = normalizeCancellationPolicy(policy)
  const bodyKey = `listingCancellation_${p}`
  return (
    <div className={cn(MOBILE_FLAT_INSET_CLASS, 'sm:bg-slate-50/90 sm:p-4 md:p-5')}>
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            {getUIText('listingCancellation_title', language)}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{getUIText(bodyKey, language)}</p>
        </div>
      </div>
    </div>
  )
}
