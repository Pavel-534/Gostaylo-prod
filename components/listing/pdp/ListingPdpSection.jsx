'use client'

import { cn } from '@/lib/utils'
import {
  LISTING_PDP_SECTION_CLASS,
  LISTING_PDP_SECTION_STACK_CLASS,
} from '@/lib/listing/pdp-section-rhythm'

/**
 * Vertical stack with one hairline between each child (Stage 201.85).
 * Only render real sections as children — never empty wrappers.
 */
export function ListingPdpSectionStack({ children, className }) {
  return <div className={cn(LISTING_PDP_SECTION_STACK_CLASS, className)}>{children}</div>
}

/**
 * One semantic PDP block. Returns null when `children` is null/false so
 * conditional sections do not leave orphan divide rules.
 */
export function ListingPdpSection({ children, className, as: Comp = 'section', ...props }) {
  if (children == null || children === false) return null
  return (
    <Comp className={cn(LISTING_PDP_SECTION_CLASS, className)} {...props}>
      {children}
    </Comp>
  )
}
