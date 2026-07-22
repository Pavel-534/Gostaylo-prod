'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'

function isCatalogPath(p) {
  return p === '/listings' || p.startsWith('/listings?')
}

function isListingPdpPath(p) {
  return /^\/listings\/[^/?]+/.test(p)
}

/**
 * Stage 115.0 / 190.3 — мягкий контекст пути гостя (без смены логики бронирования).
 * `bookingMode`: Instant Book → browse → book → pay → trips; request → … → request → …
 * @param {{ t: (key: string) => string, className?: string, bookingMode?: 'instant' | 'request' }} props
 */
export function GuestBookingFlowHint({ t, className, bookingMode = 'request' }) {
  const pathname = usePathname() || ''
  const instant = bookingMode === 'instant'
  const midStep = instant
    ? { id: 'book', href: null, match: isListingPdpPath }
    : { id: 'request', href: null, match: isListingPdpPath }

  const steps = [
    { id: 'browse', href: '/listings', match: isCatalogPath },
    midStep,
    { id: 'chat', href: '/messages', match: (p) => p.startsWith('/messages') },
    { id: 'pay', href: null, match: (p) => p.startsWith('/checkout') },
    { id: 'trips', href: '/my-bookings', match: (p) => p.startsWith('/my-bookings') || p.startsWith('/renter/bookings') },
  ]

  const activeIdx = steps.findIndex((s) => s.match(pathname))
  if (activeIdx < 0) return null

  /** On PDP / catalog / checkout — hide chat pill so Instant path doesn’t imply mandatory chat. */
  const visibleSteps = steps.filter((s, idx) => {
    if (s.id !== 'chat') return true
    return pathname.startsWith('/messages') || idx === activeIdx
  })

  return (
    <nav
      className={cn(
        'flex flex-wrap items-center gap-1 text-xs sm:text-sm text-slate-500 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2 backdrop-blur-sm',
        className,
      )}
      aria-label={t('stage115_guestFlowAria')}
      data-booking-mode={instant ? 'instant' : 'request'}
    >
      {visibleSteps.map((step, idx) => {
        const fullIdx = steps.findIndex((s) => s.id === step.id)
        const done = fullIdx < activeIdx
        const current = fullIdx === activeIdx
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
