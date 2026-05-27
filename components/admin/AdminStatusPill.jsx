'use client'

import { cn } from '@/lib/utils'

/** @type {Record<string, string>} */
const STATUS_STYLES = {
  ACTIVE: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  APPROVED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  PAID: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  READY: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  COMPLETED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  CONFIRMED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  PENDING: 'bg-amber-50 text-amber-900 border-amber-200',
  PROCESSING: 'bg-amber-50 text-amber-900 border-amber-200',
  REVIEW: 'bg-amber-50 text-amber-900 border-amber-200',
  IN_REVIEW: 'bg-amber-50 text-amber-900 border-amber-200',
  OPEN: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  RESOLVED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  CLOSED: 'bg-slate-100 text-slate-600 border-slate-200',
  FROZEN: 'bg-rose-50 text-rose-800 border-rose-200',
  REJECTED: 'bg-rose-50 text-rose-800 border-rose-200',
  FAILED: 'bg-rose-50 text-rose-800 border-rose-200',
  CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200',
  CANCELED: 'bg-slate-100 text-slate-600 border-slate-200',
  INACTIVE: 'bg-slate-100 text-slate-600 border-slate-200',
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  SUSPENDED: 'bg-rose-50 text-rose-800 border-rose-200',
  BANNED: 'bg-rose-50 text-rose-800 border-rose-200',
}

const DEFAULT_STYLE = 'bg-indigo-50 text-indigo-800 border-indigo-200'

/**
 * @param {{ status: string | null | undefined, className?: string }} props
 */
export function AdminStatusPill({ status, className }) {
  const key = String(status || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
  if (!key) return <span className={cn('text-xs text-slate-400', className)}>—</span>

  const style = STATUS_STYLES[key] || DEFAULT_STYLE

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase',
        style,
        className,
      )}
    >
      {key.replace(/_/g, ' ')}
    </span>
  )
}
