/**
 * Stage 197.0 / Wave H0 — checkout hold countdown (SSOT: checkout-hold-policy).
 */

'use client'

import { useMemo } from 'react'
import { Clock } from 'lucide-react'
import { UrgencyTimer } from '@/components/UrgencyTimer'
import { resolveCheckoutHoldExpiresAtIso } from '@/lib/booking/checkout-hold-policy.js'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'

/**
 * @param {{
 *   booking?: object | null
 *   invoice?: object | null
 *   paymentIntent?: object | null
 *   language?: string
 *   className?: string
 * }} props
 */
export function CheckoutHoldTimer({
  booking = null,
  invoice = null,
  paymentIntent = null,
  language = 'ru',
  className,
}) {
  const endsAt = useMemo(
    () =>
      resolveCheckoutHoldExpiresAtIso({
        booking,
        invoice,
        intentStartedAt:
          paymentIntent?.createdAt ||
          paymentIntent?.created_at ||
          paymentIntent?.initiated_at ||
          null,
        intentExpiresAt: paymentIntent?.expiresAt || paymentIntent?.expires_at || null,
      }),
    [booking, invoice, paymentIntent],
  )

  if (!endsAt) return null

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border border-amber-200/90 bg-gradient-to-br from-amber-50/90 via-white to-white px-4 py-3',
        className,
      )}
      data-testid="checkout-hold-timer"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
        <Clock className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-sm font-semibold text-slate-900">
          {getUIText('checkout_holdTitle', language)}
        </p>
        <p className="text-xs leading-relaxed text-slate-600">
          {getUIText('checkout_holdBody', language)}
        </p>
        <UrgencyTimer
          endsAt={endsAt}
          language={language}
          variant="compact"
          prefixKey="checkout_holdCountdownPrefix"
          endedKey="checkout_holdEnded"
          className="!from-amber-50 !via-orange-50 !to-rose-50"
        />
      </div>
    </div>
  )
}
