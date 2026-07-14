'use client'

import { cn } from '@/lib/utils'

/**
 * Stage 185.0 — inner shell for partner workspace pages (inside app/partner/layout scroll).
 * Not a replacement for partner layout; consistent max-width and overflow only.
 */
export function PartnerPageShell({ children, className }) {
  return (
    <div className={cn('mx-auto w-full max-w-6xl overflow-x-hidden pb-2', className)}>
      {children}
    </div>
  )
}
