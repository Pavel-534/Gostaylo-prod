'use client'

/**
 * Stage 200.94 — semantic section separator for partner cabinet forms.
 * Mint hairline with horizontal inset; use only between meaning groups.
 */

import { cn } from '@/lib/utils'
import {
  PARTNER_SECTION_DIVIDER_CLASS,
  PARTNER_SECTION_DIVIDER_WRAP_CLASS,
} from '@/lib/ui/partner-section-rhythm'

/**
 * @param {{ className?: string, wrapClassName?: string }} [props]
 */
export function PartnerSectionDivider({ className, wrapClassName } = {}) {
  return (
    <div
      className={cn(PARTNER_SECTION_DIVIDER_WRAP_CLASS, wrapClassName)}
      role="separator"
      data-testid="partner-section-divider"
    >
      <div className={cn(PARTNER_SECTION_DIVIDER_CLASS, className)} aria-hidden />
    </div>
  )
}
