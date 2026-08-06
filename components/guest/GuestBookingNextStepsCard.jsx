'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Clock, CreditCard, KeyRound, MessageCircle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'
import { MOBILE_FLAT_BRAND_CARD_CLASS } from '@/lib/ui/mobile-flat-canvas'
import { trackProductEvent, ProductAnalyticsEvents } from '@/lib/analytics/product-analytics.js'
import { resolveGuestNextStepsStep } from '@/lib/guest/resolve-guest-next-steps'

const TONE_CLASS = {
  amber: 'sm:border-amber-200/80 sm:bg-gradient-to-br sm:from-amber-50/90 sm:via-white sm:to-white',
  brand: 'sm:border-brand/20 sm:bg-gradient-to-br sm:from-brand/5 sm:via-white sm:to-white',
  emerald: 'sm:border-emerald-200/80 sm:bg-gradient-to-br sm:from-emerald-50/80 sm:via-white sm:to-white',
}

const ICONS = {
  clock: Clock,
  card: CreditCard,
  chat: MessageCircle,
  key: KeyRound,
}

function dismissStorageKey(bookingId) {
  const id = String(bookingId || '').trim()
  return id ? `guest_next_steps_dismissed_${id}` : null
}

/**
 * Stage 155.3 / 155.4 / 196.0-D — guest «Что дальше?» (INQUIRY → pay → day-of access + chat).
 */
export function GuestBookingNextStepsCard({
  bookingId = null,
  status,
  checkIn = null,
  accessPackVisible = false,
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
  const step = resolveGuestNextStepsStep({
    status: normalized,
    checkInIso: checkIn,
    accessPackVisible,
  })
  const storageKey = dismissStorageKey(bookingId)
  const [dismissedForStatus, setDismissedForStatus] = useState(null)
  const shownTrackedRef = useRef(false)
  const dismissToken = step ? `${step.key}:${normalized}` : null

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
  }, [storageKey, dismissToken])

  useEffect(() => {
    if (!step || dismissedForStatus === dismissToken || shownTrackedRef.current) return
    shownTrackedRef.current = true
    void trackProductEvent(ProductAnalyticsEvents.GUEST_NEXT_STEPS_SHOWN, {
      booking_id: bookingId,
      status: normalized,
      step: step.key,
      surface,
    })
  }, [bookingId, dismissedForStatus, dismissToken, normalized, step, surface])

  if (!step) return null
  if (dismissedForStatus === dismissToken) return null

  const uiCtx = categorySlug ? { listingCategorySlug: categorySlug, wizardProfile } : undefined
  const Icon = ICONS[step.icon] || MessageCircle
  const message = getUIText(step.messageKey, language, uiCtx)
  const title = getUIText('guestNextSteps_title', language)

  const showPay = step.showPay && payHref
  const showChat = step.showChat && chatHref

  function dismiss() {
    setDismissedForStatus(dismissToken)
    void trackProductEvent(ProductAnalyticsEvents.GUEST_NEXT_STEPS_DISMISS, {
      booking_id: bookingId,
      status: normalized,
      step: step.key,
      surface,
    })
    if (!storageKey || !dismissToken) return
    try {
      localStorage.setItem(storageKey, dismissToken)
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className={cn(
        MOBILE_FLAT_BRAND_CARD_CLASS,
        TONE_CLASS[step.tone] || TONE_CLASS.brand,
        compact ? 'p-3 max-sm:px-0' : 'p-4 max-sm:px-0',
        className,
      )}
      data-testid="guest-booking-next-steps"
      data-step={step.key}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
          {step.key === 'DAY_OF' || normalized === 'PAID_ESCROW' ? (
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
                    'min-h-11',
                    surface === 'pdp' && 'w-full sm:w-auto sm:min-w-[10rem] font-semibold',
                  )}
                  data-testid="guest-next-steps-pay"
                >
                  <Link href={payHref}>{getUIText('guestNextSteps_payNow', language)}</Link>
                </Button>
              ) : null}
              {showChat ? (
                <Button
                  asChild
                  variant={showPay ? 'outline' : 'brand'}
                  size="sm"
                  className="min-h-11"
                  data-testid="guest-next-steps-chat"
                >
                  <Link href={chatHref}>{getUIText('guestNextSteps_openChat', language)}</Link>
                </Button>
              ) : null}
            </div>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 px-2 text-slate-500 hover:text-slate-700"
            onClick={dismiss}
          >
            {getUIText('guestNextSteps_dismiss', language)}
          </Button>
        </div>
      </div>
    </div>
  )
}
