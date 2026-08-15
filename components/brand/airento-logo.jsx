'use client'

/**
 * Header / chrome wordmark — clean transparent AirentoMark (SVG) + optional text label.
 * No plate/ring/shadow: the vector mark sits directly on the header (light & dark safe).
 *
 * `tone`:
 *   'auto'  (default) — teal wordmark + two-tone mark on light; auto-switches to the
 *                       white wordmark + light mark under `@media (prefers-color-scheme: dark)`
 *                       or a `.dark` ancestor (see .al-* rules in globals.css)
 *   'dark'            — force light/white logo (use on dark backgrounds/heroes/footers)
 *   'light'           — force teal/two-tone logo (brand)
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
const MARK_TONE = {
  auto: 'auto',
  dark: 'onDark',
  light: 'brand',
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
  /** Clean transparent mark — no plate/ring/shadow (mark is wider than tall ~1.29:1). */
  const markSize = compact ? 38 : 46
  const wordTone = WORD_TONE[tone] || WORD_TONE.auto
  const subTone = SUB_TONE[tone] || SUB_TONE.auto
  const markTone = MARK_TONE[tone] || MARK_TONE.auto

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
