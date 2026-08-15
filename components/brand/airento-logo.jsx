'use client'

/**
 * Header / chrome wordmark — AirentoMark (PNG SSOT) + optional text label.
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
  /** Stage 201.36 — mark1 fills the plate more; slightly larger glyph + tighter pad. */
  const markSize = compact ? 30 : 36
  const boxSize = compact ? 'h-10 w-10' : 'h-12 w-12'

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        className={cn(
          'grid place-items-center rounded-2xl bg-white p-1 ring-1 ring-slate-200 shadow-[0_10px_24px_rgba(0,102,102,0.16)] transition-opacity duration-300',
          boxSize,
          scrolled ? 'opacity-90' : 'opacity-100',
        )}
      >
        <AirentoMark size={markSize} />
      </div>
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
