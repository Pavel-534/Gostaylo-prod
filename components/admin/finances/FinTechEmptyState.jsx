'use client'

import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * @param {{ icon?: import('react').ComponentType<{ className?: string }>, title: string, description: string, className?: string }} props
 */
export function FinTechEmptyState({ icon: Icon = Inbox, title, description, className }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-10 text-center',
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand-hover mb-3">
        <Icon className="h-6 w-6" />
      </div>
      <p className="font-medium text-slate-800">{title}</p>
      <p className="text-sm text-slate-500 mt-1 max-w-md">{description}</p>
    </div>
  )
}
