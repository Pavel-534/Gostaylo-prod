'use client'

import { useEffect, useMemo, useState } from 'react'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'

function pad2(n) {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0')
}

/**
 * Live countdown until `endsAt` (ISO). Used for Flash Sale promos (`valid_until` SSOT).
 * @param {{ endsAt: string }} props
 */
export function UrgencyTimer({ endsAt, language = 'ru', variant = 'default', className }) {
  const endMs = useMemo(() => {
    const t = endsAt ? new Date(endsAt).getTime() : NaN
    return Number.isFinite(t) ? t : NaN
  }, [endsAt])

  const [tick, setTick] = useState(() => Date.now())

  useEffect(() => {
    if (!Number.isFinite(endMs)) return undefined
    const id = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [endMs])

  if (!Number.isFinite(endMs)) return null

  const sec = Math.max(0, Math.floor((endMs - tick) / 1000))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const time = `${pad2(h)}:${pad2(m)}:${pad2(s)}`

  if (sec <= 0) {
    return (
      <div className={cn('text-xs font-medium text-slate-500', className)} role="status">
        {getUIText('promo_urgency_ended', language)}
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
    >
      <span className="font-semibold text-orange-950">
        {getUIText('promo_urgency_countdown_prefix', language)}
      </span>{' '}
      <span className="tabular-nums font-bold tracking-tight text-orange-600">{time}</span>
    </div>
  )
}
