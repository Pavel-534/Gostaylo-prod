'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'

const STEPS = [
  { id: 'browse', href: '/listings', match: (p) => p.startsWith('/listings') },
  { id: 'chat', href: '/messages', match: (p) => p.startsWith('/messages') },
  { id: 'pay', href: null, match: (p) => p.startsWith('/checkout') },
  { id: 'trips', href: '/renter/bookings', match: (p) => p.startsWith('/renter/bookings') || p.startsWith('/my-bookings') },
]

/**
 * Stage 115.0 — мягкий контекст пути гостя (без смены логики бронирования).
 * @param {{ t: (key: string) => string, className?: string }} props
 */
export function GuestBookingFlowHint({ t, className }) {
  const pathname = usePathname() || ''
  const activeIdx = STEPS.findIndex((s) => s.match(pathname))
  if (activeIdx < 0) return null

  return (
    <nav
      className={cn(
        'flex flex-wrap items-center gap-1 text-xs sm:text-sm text-slate-500 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2 backdrop-blur-sm',
        className,
      )}
      aria-label={t('stage115_guestFlowAria')}
    >
      {STEPS.map((step, idx) => {
        const done = idx < activeIdx
        const current = idx === activeIdx
        const label = t(`stage115_guestFlow_${step.id}`)
        const pillClass = cn(
          'rounded-lg px-2 py-0.5 transition-colors',
          current && 'bg-brand/10 text-brand font-semibold',
          done && !current && 'text-slate-700',
          !done && !current && 'text-slate-400',
        )
        return (
          <span key={step.id} className="inline-flex items-center gap-1">
            {idx > 0 ? <ChevronRight className="h-3 w-3 text-slate-300 shrink-0" aria-hidden /> : null}
            {step.href && !current ? (
              <Link href={step.href} className={cn(pillClass, 'hover:text-brand')}>
                {label}
              </Link>
            ) : (
              <span className={pillClass} aria-current={current ? 'step' : undefined}>
                {label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
