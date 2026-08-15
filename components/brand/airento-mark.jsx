'use client'

/**
 * Brand mark SSOT — vectors from public/brand/.
 *
 * `tone`:
 *   'brand'  (default) — two-tone teal/gray mark (airento-mark.svg), transparent
 *   'onDark'           — bright variant (airento-mark-light.svg) for dark surfaces
 *   'badge'            — mark on white rounded chip baked into SVG (header / forced-dark proof)
 *   'auto'             — brand + light; CSS swaps under prefers-color-scheme / .dark
 *                        (prefer 'badge' in AppHeader — auto alone fails under forced dark)
 */

import { cn } from '@/lib/utils'

const SRC = {
  brand: '/brand/airento-mark.svg',
  onDark: '/brand/airento-mark-light.svg',
  badge: '/brand/airento-mark-badge.svg',
}

export function AirentoMark({ size = 32, className = '', tone = 'brand' }) {
  const common = { alt: '', width: size, height: size, draggable: false }

  if (tone === 'auto') {
    return (
      <span
        className={cn('al-mark-auto inline-flex items-center justify-center', className)}
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand vector asset */}
        <img
          src={SRC.brand}
          {...common}
          className="al-mark-brand object-contain select-none"
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand vector asset */}
        <img
          src={SRC.onDark}
          {...common}
          className="al-mark-light object-contain select-none"
        />
      </span>
    )
  }

  const src = SRC[tone] || SRC.brand

  return (
    // eslint-disable-next-line @next/next/no-img-element -- static brand vector asset
    <img
      src={src}
      {...common}
      className={cn('object-contain select-none', className)}
    />
  )
}
