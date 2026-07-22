'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Clock, CreditCard, MessageCircle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'
import { trackProductEvent, ProductAnalyticsEvents } from '@/lib/analytics/product-analytics.js'

const STEPS = {
  PENDING: { messageKey: 'guestNextSteps_pending', icon: Clock, tone: 'amber' },
  INQUIRY: { messageKey: 'guestNextSteps_pending', icon: Clock, tone: 'amber' },
  AWAITING_PAYMENT: { messageKey: 'guestNextSteps_awaitingPayment', icon: CreditCard, tone: 'brand' },
  PAID_ESCROW: { messageKey: 'guestNextSteps_paidEscrow', icon: MessageCircle, tone: 'emerald' },
}

const TONE_CLASS = {
  amber: 'border-amber-200/80 bg-gradient-to-br from-amber-50/90 via-white to-white',
  brand: 'border-brand/20 bg-gradient-to-br from-brand/5 via-white to-white',
  emerald: 'border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 via-white to-white',
}

function dismissStorageKey(bookingId) {
  const id = String(bookingId || '').trim()
  return id ? `guest_next_steps_dismissed_${id}` : null
}

/**
 * Stage 155.3 / 155.4 — guest «Что дальше?» helper (INQUIRY → pay → escrow chat).
 * @param {{
 *   bookingId?: string | null,
 *   status?: string | null,
 *   language?: string,
 *   categorySlug?: string | null,
 *   wizardProfile?: string | null,
 *   chatHref?: string | null,
 *   payHref?: string | null,
 *   className?: string,
 *   compact?: boolean,
 *   surface?: 'pdp' | 'my_bookings' | 'chat' | string,
 * }} props
 */
export function GuestBookingNextStepsCard({
  bookingId = null,
  status,
  language = 'ru',
  categorySlug = null,
  wizardProfile = null,
  chatHref = null,
  payHref = null,
  className,
  compact = false,
  surface = 'my_bookings',
}) {
  const normalized = String(status || '').toUpperCase()
  const step = STEPS[normalized]
  const storageKey = dismissStorageKey(bookingId)
  const [dismissedForStatus, setDismissedForStatus] = useState(null)
  const shownTrackedRef = useRef(false)

  useEffect(() => {
    if (!storageKey) {
      setDismissedForStatus(null)
      return
    }
    try {
      setDismissedForStatus(localStorage.getItem(storageKey))
    } catch {
      setDismissedForStatus(null)
    }
  }, [storageKey, normalized])

  useEffect(() => {
    if (!step || dismissedForStatus === normalized || shownTrackedRef.current) return
    shownTrackedRef.current = true
    void trackProductEvent(ProductAnalyticsEvents.GUEST_NEXT_STEPS_SHOWN, {
      booking_id: bookingId,
      status: normalized,
      surface,
    })
  }, [bookingId, dismissedForStatus, normalized, step, surface])

  if (!step) return null
  if (dismissedForStatus === normalized) return null

  const uiCtx = categorySlug ? { listingCategorySlug: categorySlug, wizardProfile } : undefined
  const Icon = step.icon
  const message = getUIText(step.messageKey, language, uiCtx)
  const title = getUIText('guestNextSteps_title', language)

  const showPay = normalized === 'AWAITING_PAYMENT' && payHref
  const showChat =
    (normalized === 'PAID_ESCROW' || normalized === 'PENDING' || normalized === 'INQUIRY') && chatHref

  function dismiss() {
    setDismissedForStatus(normalized)
    void trackProductEvent(ProductAnalyticsEvents.GUEST_NEXT_STEPS_DISMISS, {
      booking_id: bookingId,
      status: normalized,
      surface,
    })
    if (!storageKey) return
    try {
      localStorage.setItem(storageKey, normalized)
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className={cn(
        'rounded-2xl border shadow-sm',
        TONE_CLASS[step.tone] || TONE_CLASS.brand,
        compact ? 'p-3' : 'p-4',
        className,
      )}
      data-testid="guest-booking-next-steps"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
          {normalized === 'PAID_ESCROW' ? (
            <Sparkles className="h-4 w-4" aria-hidden />
          ) : (
            <Icon className="h-4 w-4" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className={cn('font-semibold text-slate-900', compact ? 'text-sm' : 'text-base')}>
            {title}
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
          {showPay || showChat ? (
            <div
              className={cn(
                'flex flex-wrap gap-2 pt-0.5',
                surface === 'pdp' && showPay ? 'w-full flex-col sm:flex-row' : null,
              )}
            >
              {showPay ? (
                <Button
                  asChild
                  variant="brand"
                  size={surface === 'pdp' ? 'default' : 'sm'}
                  className={cn(
                    surface === 'pdp' &&
                      'min-h-11 w-full sm:w-auto sm:min-w-[10rem] font-semibold',
                  )}
                  data-testid="guest-next-steps-pay"
                >
                  <Link href={payHref}>{getUIText('guestNextSteps_payNow', language)}</Link>
                </Button>
              ) : null}
              {showChat ? (
                <Button asChild variant={showPay ? 'outline' : 'brand'} size="sm">
                  <Link href={chatHref}>{getUIText('guestNextSteps_openChat', language)}</Link>
                </Button>
              ) : null}
            </div>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-slate-500 hover:text-slate-700"
            onClick={dismiss}
          >
            {getUIText('guestNextSteps_dismiss', language)}
          </Button>
        </div>
      </div>
    </div>
  )
}
