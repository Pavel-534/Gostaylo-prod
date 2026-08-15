'use client'

/**
 * Brand mark SSOT — clean two-tone vector from public/brand/airento-mark.svg
 * (same master used by scripts/generate-brand-icons.py for all PWA/favicon assets).
 * Transparent background, crisp at any size, works on light & dark chrome.
 */

import { cn } from '@/lib/utils'

export function AirentoMark({ size = 32, className = '' }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static brand vector asset
    <img
      src="/brand/airento-mark.svg"
      alt=""
      width={size}
      height={size}
      draggable={false}
      className={cn('object-contain select-none', className)}
    />
  )
}
