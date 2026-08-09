'use client'

import { useEffect, useMemo, useState } from 'react'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'

function pad2(n) {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0')
}

/**
 * Live countdown until `endsAt` (ISO). Flash Sale / checkout hold / partner SLA / etc.
 * Hydration-safe: first paint uses `--:--:--` until mount (no client/server clock mismatch).
 *
 * @param {{
 *   endsAt: string,
 *   language?: string,
 *   variant?: 'default'|'compact',
 *   prefixKey?: string,
 *   endedKey?: string,
 *   prefix?: string|null,
 *   endedLabel?: string|null,
 *   uiCtx?: object,
 *   className?: string,
 * }} props
 */
export function UrgencyTimer({
  endsAt,
  language = 'ru',
  variant = 'default',
  prefixKey = 'promo_urgency_countdown_prefix',
  endedKey = 'promo_urgency_ended',
  prefix = null,
  endedLabel = null,
  uiCtx,
  className,
}) {
  const endMs = useMemo(() => {
    const t = endsAt ? new Date(endsAt).getTime() : NaN
    return Number.isFinite(t) ? t : NaN
  }, [endsAt])

  /** null until mounted — avoids SSR/client Date.now() hydration drift on digits */
  const [nowMs, setNowMs] = useState(null)

  useEffect(() => {
    if (!Number.isFinite(endMs)) return undefined
    setNowMs(Date.now())
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [endMs])

  if (!Number.isFinite(endMs)) return null

  const prefixText =
    prefix != null && String(prefix).trim() !== ''
      ? String(prefix)
      : getUIText(prefixKey, language, uiCtx)
  const endedText =
    endedLabel != null && String(endedLabel).trim() !== ''
      ? String(endedLabel)
      : getUIText(endedKey, language, uiCtx)

  const live = nowMs != null
  const sec = live ? Math.max(0, Math.floor((endMs - nowMs) / 1000)) : null
  const time =
    sec == null
      ? '--:--:--'
      : `${pad2(Math.floor(sec / 3600))}:${pad2(Math.floor((sec % 3600) / 60))}:${pad2(sec % 60)}`

  if (live && sec <= 0) {
    return (
      <div className={cn('text-xs font-medium text-slate-500', className)} role="status">
        {endedText}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-orange-200/90 bg-gradient-to-r from-orange-50 via-amber-50 to-rose-50 px-3 py-2 text-sm text-orange-950 shadow-sm',
        variant === 'compact' && 'py-1.5 text-xs px-2.5',
        className,
      )}
      role="status"
      aria-live="polite"
      data-testid="urgency-timer"
      data-hydrated={live ? 'true' : 'false'}
    >
      <span className="font-semibold text-orange-950">{prefixText}</span>{' '}
      <span className="tabular-nums font-bold tracking-tight text-orange-600">{time}</span>
    </div>
  )
}
