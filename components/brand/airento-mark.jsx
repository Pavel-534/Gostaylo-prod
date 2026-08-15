'use client'

/**
 * Brand mark SSOT — clean two-tone vector from public/brand/airento-mark.svg
 * (same master used by scripts/generate-brand-icons.py for all PWA/favicon assets).
 *
 * `tone`:
 *   'brand'  (default) — two-tone teal/gray mark, for light backgrounds
 *   'onDark'           — bright light variant (airento-mark-light.svg), for dark backgrounds
 *   'auto'             — renders both; CSS swaps to the light variant under
 *                        `@media (prefers-color-scheme: dark)` or a `.dark` ancestor
 *                        (see .al-mark-* rules in globals.css)
 */

import { cn } from '@/lib/utils'

export function AirentoMark({ size = 32, className = '', tone = 'brand' }) {
  const common = { alt: '', width: size, height: size, draggable: false }

  if (tone === 'onDark') {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- static brand vector asset
      <img
        src="/brand/airento-mark-light.svg"
        {...common}
        className={cn('object-contain select-none', className)}
      />
    )
  }

  if (tone === 'auto') {
    return (
      <span
        className={cn('al-mark-auto inline-flex items-center justify-center', className)}
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand vector asset */}
        <img
          src="/brand/airento-mark.svg"
          {...common}
          className="al-mark-brand object-contain select-none"
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand vector asset */}
        <img
          src="/brand/airento-mark-light.svg"
          {...common}
          className="al-mark-light object-contain select-none"
        />
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- static brand vector asset
    <img
      src="/brand/airento-mark.svg"
      {...common}
      className={cn('object-contain select-none', className)}
    />
  )
}
