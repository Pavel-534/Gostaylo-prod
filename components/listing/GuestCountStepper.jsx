'use client'

import { Minus, Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function GuestCountStepper({
  value,
  onChange,
  min = 1,
  max,
  className,
  disabled = false,
}) {
  const safeMax = Math.max(min, Number(max) || min)
  const n = Math.min(safeMax, Math.max(min, Number(value) || min))

  const dec = () => onChange(Math.max(min, n - 1))
  const inc = () => onChange(Math.min(safeMax, n + 1))

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Users className="h-4 w-4 text-slate-400 shrink-0" aria-hidden />
      <div className="flex flex-1 items-stretch rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-12 w-11 shrink-0 rounded-none border-r border-slate-200 hover:bg-slate-50"
          onClick={dec}
          disabled={disabled || n <= min}
          aria-label="Decrease guests"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <output
          className="flex min-w-[2.5rem] flex-1 items-center justify-center text-base font-semibold tabular-nums text-slate-900"
          aria-live="polite"
        >
          {n}
        </output>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-12 w-11 shrink-0 rounded-none border-l border-slate-200 hover:bg-slate-50"
          onClick={inc}
          disabled={disabled || n >= safeMax}
          aria-label="Increase guests"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
