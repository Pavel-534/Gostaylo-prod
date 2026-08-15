'use client'

/**
 * Brand mark SSOT — raster from public/brand/airento-mark.png
 * (same asset as PWA icons via scripts/generate-pwa-icons.mjs).
 * Stage 201.36 — promoted former airento-mark1 (tighter crop, denser glyph).
 */

import { cn } from '@/lib/utils'

export function AirentoMark({ size = 32, className = '' }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static brand asset; avoids SVG approximation drift
    <img
      src="/brand/airento-mark.png"
      alt=""
      width={size}
      height={size}
      draggable={false}
      className={cn('object-contain select-none', className)}
    />
  )
}
