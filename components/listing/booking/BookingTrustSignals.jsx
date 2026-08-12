/**
 * Stage 199.1 / 200.122 — PDP booking trust strip (display-only, next to Book CTA).
 */

'use client'

import Link from 'next/link'
import { MessageCircle, ShieldCheck, Undo2 } from 'lucide-react'
import { getUIText } from '@/lib/translations'
import { getSiteDisplayName } from '@/lib/site-url'
import { cn } from '@/lib/utils'
import { listingCancellationAnchorHref } from '@/lib/listing/listing-cancellation-anchor.js'
import { resolveListingCancellationPolicy } from '@/lib/listing/listing-good-to-know'
import { resolveListingBookingTrustCancelLabel } from '@/lib/listing/listing-booking-trust-cancel.js'

export { resolveListingBookingTrustCancelLabel } from '@/lib/listing/listing-booking-trust-cancel.js'

/**
 * @param {{
 *   language?: string
 *   listingCategorySlug?: string | null
 *   wizardProfile?: string | null
 *   listing?: object | null
 *   cancellationPolicy?: string | null
 *   className?: string
 *   compact?: boolean
 * }} props
 */
export function BookingTrustSignals({
  language = 'ru',
  listingCategorySlug = null,
  wizardProfile = null,
  listing = null,
  cancellationPolicy = null,
  className,
  compact = false,
}) {
  const brand = getSiteDisplayName()
  const uiCtx = {
    listingCategorySlug: listingCategorySlug || 'apartments',
    wizardProfile: wizardProfile || null,
  }
  const policyRaw =
    cancellationPolicy ?? resolveListingCancellationPolicy(listing) ?? null
  const escrow = getUIText('listingBookingTrust_escrow', language).replace(/\{brand\}/g, brand)
  const cancel = resolveListingBookingTrustCancelLabel(policyRaw, language)
  const cancelHref = listingCancellationAnchorHref()
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
      href: cancelHref,
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
          'flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs leading-relaxed text-slate-500',
          className,
        )}
        data-testid="listing-booking-trust-signals"
        aria-label={aria}
      >
        <ShieldCheck className="h-3 w-3 shrink-0 text-brand" aria-hidden />
        <Link
          href="/help/escrow-protection"
          className="underline-offset-2 hover:text-brand-hover hover:underline"
          data-testid="listing-booking-trust-escrow"
        >
          {escrow}
        </Link>
        <span className="text-slate-300" aria-hidden>
          ·
        </span>
        <a
          href={cancelHref}
          className="underline-offset-2 hover:text-brand-hover hover:underline"
          data-testid="listing-booking-trust-cancel"
        >
          {cancel}
        </a>
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
        'space-y-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-xs leading-relaxed text-slate-600',
        className,
      )}
      data-testid="listing-booking-trust-signals"
      aria-label={aria}
    >
      {items.map(({ key, Icon, label, href }) => (
        <li key={key} className="flex items-start gap-2">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
          {href ? (
            href.startsWith('#') ? (
              <a
                href={href}
                className="min-w-0 font-medium text-slate-700 underline-offset-2 hover:text-brand-hover hover:underline"
                data-testid={`listing-booking-trust-${key}`}
              >
                {label}
              </a>
            ) : (
              <Link
                href={href}
                className="min-w-0 font-medium text-slate-700 underline-offset-2 hover:text-brand-hover hover:underline"
                data-testid={`listing-booking-trust-${key}`}
              >
                {label}
              </Link>
            )
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
