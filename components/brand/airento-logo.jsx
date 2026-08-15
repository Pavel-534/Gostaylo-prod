'use client'

/**
 * Header / chrome wordmark — badge mark (white chip baked into SVG) + optional label.
 *
 * Forced-dark (Samsung/Chrome) inverts CSS backgrounds but usually leaves <img> pixels alone.
 * A CSS white plate therefore becomes dark while the teal mark stays dark → invisible + “layers”.
 * SSOT for header: `/brand/airento-mark-badge.svg` (white rounded rect + brand mark in one image).
 *
 * `tone`:
 *   'auto'|'light' (default) — badge SVG (header chrome)
 *   'dark'                   — light mark, no badge (heroes / intentional dark surfaces)
 */

import { AirentoMark } from '@/components/brand/airento-mark'
import { cn } from '@/lib/utils'

const WORD_TONE = {
  auto: 'al-word',
  dark: 'text-white',
  light: 'text-brand',
}
const SUB_TONE = {
  auto: 'al-sub',
  dark: 'text-slate-200/85',
  light: 'text-slate-500/90',
}

export function AirentoLogo({
  compact = false,
  className = '',
  label = '',
  scrolled = false,
  hideLabelOnMobile = false,
  tone = 'auto',
}) {
  const showLabel = Boolean(String(label || '').trim())
  /** Badge already includes pad; slightly larger than bare mark. */
  const markSize = compact ? 40 : 48
  const wordTone = WORD_TONE[tone] || WORD_TONE.auto
  const subTone = SUB_TONE[tone] || SUB_TONE.auto
  const markTone = tone === 'dark' ? 'onDark' : 'badge'

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <AirentoMark
        size={markSize}
        tone={markTone}
        className={cn(
          'transition-opacity duration-300',
          scrolled ? 'opacity-95' : 'opacity-100',
        )}
      />
      {showLabel ? (
        <div className={cn('flex flex-col', hideLabelOnMobile ? 'hidden sm:flex' : '')}>
          <span
            className={cn(
              'font-black leading-none tracking-[0.08em] transition-opacity duration-300',
              wordTone,
              compact ? 'text-lg' : 'text-xl',
              scrolled ? 'opacity-90' : 'opacity-100',
            )}
          >
            {label}
          </span>
          <span
            className={cn(
              'text-[10px] font-semibold uppercase tracking-[0.16em]',
              subTone,
            )}
          >
            rentals
          </span>
        </div>
      ) : null}
    </div>
  )
}

export default AirentoLogo
