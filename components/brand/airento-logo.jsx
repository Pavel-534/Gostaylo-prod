'use client'

/**
 * Header / chrome wordmark — clean transparent AirentoMark (SVG) + optional text label.
 * No plate/ring/shadow: the vector mark sits directly on the header (light & dark safe).
 */

import { AirentoMark } from '@/components/brand/airento-mark'
import { cn } from '@/lib/utils'

export function AirentoLogo({
  compact = false,
  className = '',
  label = '',
  scrolled = false,
  hideLabelOnMobile = false,
}) {
  const showLabel = Boolean(String(label || '').trim())
  /** Clean transparent mark — no plate/ring/shadow (mark is wider than tall ~1.29:1). */
  const markSize = compact ? 38 : 46

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <AirentoMark
        size={markSize}
        className={cn(
          'transition-opacity duration-300',
          scrolled ? 'opacity-95' : 'opacity-100',
        )}
      />
      {showLabel ? (
        <div className={cn('flex flex-col', hideLabelOnMobile ? 'hidden sm:flex' : '')}>
          <span
            className={cn(
              'font-black leading-none tracking-[0.08em] text-brand transition-opacity duration-300',
              compact ? 'text-lg' : 'text-xl',
              scrolled ? 'opacity-90' : 'opacity-100',
            )}
          >
            {label}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500/90">
            rentals
          </span>
        </div>
      ) : null}
    </div>
  )
}

export default AirentoLogo
