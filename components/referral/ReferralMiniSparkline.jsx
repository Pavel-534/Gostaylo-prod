'use client'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * Компактный SVG sparkline для ряда неотрицательных чисел (например THB по дням).
 * @param {{ tooltip?: string }} props — подсказка с датами в формате DD.MM.YYYY (Stage 73.7).
 */
export function ReferralMiniSparkline({
  values = [],
  strokeClassName = 'text-teal-600',
  height = 36,
  tooltip = '',
}) {
  const raw = Array.isArray(values) ? values.map((v) => Number(v) || 0) : []
  const n = raw.length
  if (n < 2) return null
  const sum = raw.reduce((a, b) => a + b, 0)
  if (sum <= 0) return null

  const max = Math.max(...raw, 1)
  const w = 120
  const h = Math.max(24, Math.min(56, height))
  const pad = 2
  const pointsStr = raw
    .map((v, i) => {
      const x = pad + (i / Math.max(n - 1, 1)) * (w - pad * 2)
      const y = h - pad - (max > 0 ? (v / max) * (h - pad * 2) : 0)
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  const svg = (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={`shrink-0 opacity-90 ${strokeClassName}`}
      aria-hidden
    >
      <polyline
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke="currentColor"
        points={pointsStr}
      />
    </svg>
  )

  const tip = String(tooltip || '').trim()
  if (!tip) return svg

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-help touch-manipulation">{svg}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[280px] text-xs tabular-nums">
          {tip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
