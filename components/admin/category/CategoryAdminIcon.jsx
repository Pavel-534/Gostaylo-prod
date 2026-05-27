'use client'

import { cn } from '@/lib/utils'

const NAMED_EMOJI = {
  Home: '🏠',
  Car: '🚗',
  Map: '🗺️',
  Anchor: '⚓',
  Layers: '📂',
}

/**
 * Премиальный контейнер иконки категории (emoji или lucide-key fallback).
 * @param {{ icon?: string | null, active?: boolean, className?: string }} props
 */
export function CategoryAdminIcon({ icon, active = true, className }) {
  const raw = String(icon || '').trim()
  const glyph = NAMED_EMOJI[raw] || raw || '🏷️'

  return (
    <div
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl sm:h-12 sm:w-12 sm:text-2xl shadow-lg ring-1 ring-white/20',
        active
          ? 'bg-gradient-to-br from-brand to-emerald-600 shadow-brand/25'
          : 'bg-slate-400/80 shadow-slate-900/10',
        className,
      )}
      aria-hidden
    >
      <span className="leading-none select-none">{glyph}</span>
    </div>
  )
}
