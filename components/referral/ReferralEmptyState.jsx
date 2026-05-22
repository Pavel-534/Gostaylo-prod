'use client'

import { cn } from '@/lib/utils'

/**
 * Stage 114.7 — единое пустое состояние для referral UI.
 * @param {{ icon?: import('react').ComponentType<{ className?: string }>, title: string, description?: string, action?: import('react').ReactNode, className?: string }} props
 */
export function ReferralEmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center text-center py-10 px-4 rounded-xl border border-dashed border-slate-200 bg-gradient-to-b from-slate-50/90 to-white',
        className,
      )}
    >
      {Icon ? <Icon className="h-10 w-10 text-teal-600/40 mb-3" aria-hidden /> : null}
      <p className="font-semibold text-slate-900">{title}</p>
      {description ? <p className="text-sm text-slate-600 mt-2 max-w-md leading-relaxed">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
