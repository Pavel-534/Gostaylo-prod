'use client'

import { cn } from '@/lib/utils'

export function ChatDateSeparator({ label, className }) {
  if (!label) return null
  return (
    <div className={cn('flex items-center justify-center py-3 px-2', className)} role="separator">
      <span className="rounded-full bg-slate-200/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm">
        {label}
      </span>
    </div>
  )
}
