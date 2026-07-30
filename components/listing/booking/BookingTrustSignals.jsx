/**
 * Stage 199.1 — PDP booking trust strip (display-only, next to Book CTA).
 */

'use client'

import Link from 'next/link'
import { MessageCircle, ShieldCheck, Undo2 } from 'lucide-react'
import { getUIText } from '@/lib/translations'
import { getSiteDisplayName } from '@/lib/site-url'
import { cn } from '@/lib/utils'

/**
 * @param {{
 *   language?: string
 *   listingCategorySlug?: string | null
 *   wizardProfile?: string | null
 *   className?: string
 *   compact?: boolean
 * }} props
 */
export function BookingTrustSignals({
  language = 'ru',
  listingCategorySlug = null,
  wizardProfile = null,
  className,
  compact = false,
}) {
  const brand = getSiteDisplayName()
  const uiCtx = {
    listingCategorySlug: listingCategorySlug || 'apartments',
    wizardProfile: wizardProfile || null,
  }
  const escrow = getUIText('listingBookingTrust_escrow', language).replace(/\{brand\}/g, brand)
  const cancel = getUIText('listingBookingTrust_cancel', language)
  const chat = getUIText('listingBookingTrust_chat', language, uiCtx)
  const aria = getUIText('listingBookingTrust_aria', language).replace(/\{brand\}/g, brand)

  const items = [
    {
      key: 'escrow',
      Icon: ShieldCheck,
      label: escrow,
      href: '/help/escrow-protection',
    },
    {
      key: 'cancel',
      Icon: Undo2,
      label: cancel,
      href: null,
    },
    {
      key: 'chat',
      Icon: MessageCircle,
      label: chat,
      href: null,
    },
  ]

  if (compact) {
    return (
      <p
        className={cn(
          'flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] leading-snug text-slate-500',
          className,
        )}
        data-testid="listing-booking-trust-signals"
        aria-label={aria}
      >
        <ShieldCheck className="h-3 w-3 shrink-0 text-brand" aria-hidden />
        <span data-testid="listing-booking-trust-escrow">{escrow}</span>
        <span className="text-slate-300" aria-hidden>
          ·
        </span>
        <span data-testid="listing-booking-trust-cancel">{cancel}</span>
        <span className="text-slate-300" aria-hidden>
          ·
        </span>
        <span data-testid="listing-booking-trust-chat">{chat}</span>
      </p>
    )
  }

  return (
    <ul
      className={cn(
        'space-y-1.5 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-xs leading-snug text-slate-600',
        className,
      )}
      data-testid="listing-booking-trust-signals"
      aria-label={aria}
    >
      {items.map(({ key, Icon, label, href }) => (
        <li key={key} className="flex items-start gap-2">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
          {href ? (
            <Link
              href={href}
              className="min-w-0 font-medium text-slate-700 underline-offset-2 hover:text-brand-hover hover:underline"
              data-testid={`listing-booking-trust-${key}`}
            >
              {label}
            </Link>
          ) : (
            <span className="min-w-0" data-testid={`listing-booking-trust-${key}`}>
              {label}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
