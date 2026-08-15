'use client'

/**
 * Header / chrome wordmark — AirentoMark on a light plate (forced-dark proof) + optional label.
 *
 * Why a plate (not CSS swap alone): Samsung/Chrome algorithmic dark darkens the header
 * background but often leaves the brand SVG as dark teal — invisible. A white chip with
 * `color-scheme: light only` + `forced-color-adjust: none` keeps the familiar brand mark
 * readable. Light SVG (`tone="dark"` / onDark) is for intentional dark surfaces without a plate.
 *
 * `tone`:
 *   'auto'  (default) — brand mark on plate; teal wordmark (see .al-* in globals.css)
 *   'dark'            — light mark + white wordmark, no plate (heroes / dark chrome)
 *   'light'           — brand mark on plate; teal wordmark
 *
 * `plate`: override; default true except when tone === 'dark'.
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
  plate,
}) {
  const showLabel = Boolean(String(label || '').trim())
  /** Mark is wider than tall ~1.29:1; plate adds a few px of pad. */
  const markSize = compact ? 38 : 46
  const usePlate = plate ?? tone !== 'dark'
  const wordTone = WORD_TONE[tone] || WORD_TONE.auto
  const subTone = SUB_TONE[tone] || SUB_TONE.auto
  /** On plate always brand; off plate follow tone (dark → onDark). */
  const markTone = usePlate ? 'brand' : tone === 'dark' ? 'onDark' : 'brand'

  const mark = (
    <AirentoMark
      size={markSize}
      tone={markTone}
      className={cn(
        'transition-opacity duration-300',
        scrolled ? 'opacity-95' : 'opacity-100',
      )}
    />
  )

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      {usePlate ? (
        <span className="al-logo-plate" data-testid="airento-logo-plate">
          {mark}
        </span>
      ) : (
        mark
      )}
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
