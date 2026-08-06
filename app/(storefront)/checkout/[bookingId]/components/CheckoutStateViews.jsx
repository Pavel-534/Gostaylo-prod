'use client'

import Link from 'next/link'
import {
  CreditCard,
  Loader2,
  MessageSquare,
  CalendarRange,
  Shield,
  HelpCircle,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StorefrontStateView } from '@/components/product/StorefrontStateView'
import { getUIText } from '@/lib/translations'
import { trackProductEvent, ProductAnalyticsEvents } from '@/lib/analytics/product-analytics.js'
import { cn } from '@/lib/utils'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
} from '@/lib/ui/mobile-flat-canvas'

function trackCheckoutEscapeClick(placement, bookingId = null) {
  void trackProductEvent(ProductAnalyticsEvents.CHECKOUT_ESCAPE_CLICK, {
    placement,
    booking_id: bookingId,
  })
}

const SUCCESS_NEXT_STEP_KEYS = [
  'checkout_successNextSteps_1',
  'checkout_successNextSteps_2',
  'checkout_successNextSteps_3',
  'checkout_successNextSteps_4',
]

const SUCCESS_NEXT_STEP_ICONS = [MessageSquare, CalendarRange, Shield, HelpCircle]

export function CheckoutFullPageSpinner() {
  return (
    <div
      className="min-h-screen bg-slate-50 flex items-center justify-center"
      data-testid="checkout-loading"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-12 w-12 animate-spin text-brand" aria-hidden />
    </div>
  )
}

export function CheckoutAccessDeniedView({ language, bookingId = null }) {
  const checkoutPath = bookingId
    ? `/checkout/${encodeURIComponent(String(bookingId))}`
    : '/checkout'
  const loginHref = `/auth/login?redirect=${encodeURIComponent(checkoutPath)}`

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <Card className={cn(MOBILE_FLAT_CARD_CLASS, 'w-full max-w-md')}>
        <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'space-y-4 text-center max-sm:py-6 sm:pt-6')}>
          <h3 className="text-xl font-semibold mb-2">{getUIText('checkout_accessDeniedTitle', language)}</h3>
          <p className="text-slate-600 mb-2">{getUIText('checkout_accessDeniedBody', language)}</p>
          <div className="flex flex-col gap-2">
            <Button asChild variant="brand" className="min-h-11 w-full font-semibold" data-testid="checkout-access-denied-login">
              <Link
                href={loginHref}
                onClick={() => trackCheckoutEscapeClick('access_denied_login', bookingId)}
              >
                {getUIText('checkout_accessDeniedLogin', language)}
              </Link>
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button asChild variant="outline" className="min-h-11">
                <Link href="/">{getUIText('checkout_home', language)}</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => window.location.reload()}
              >
                {getUIText('checkout_refresh', language)}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function CheckoutUnavailableView({ language, bookingId = null, chatHref = null }) {
  const bookingDetailsHref = bookingId
    ? `/my-bookings?booking=${encodeURIComponent(String(bookingId))}`
    : '/my-bookings'

  return (
    <StorefrontStateView
      variant="denied"
      testId="checkout-unavailable"
      className="min-h-screen bg-slate-50"
      title={getUIText('checkout_unavailableTitle', language)}
      body={getUIText('checkout_unavailableBody', language)}
      primaryLabel={getUIText('checkout_escapeBookingDetails', language)}
      primaryHref={bookingDetailsHref}
      onPrimaryClick={() => trackCheckoutEscapeClick('unavailable_booking_details', bookingId)}
      secondaryLabel={
        chatHref ? getUIText('checkout_escapeOpenChat', language) : getUIText('checkout_home', language)
      }
      secondaryHref={chatHref || '/'}
      onSecondaryClick={
        chatHref ? () => trackCheckoutEscapeClick('unavailable_open_chat', bookingId) : undefined
      }
      tertiaryLabel={chatHref ? getUIText('checkout_home', language) : undefined}
      tertiaryHref={chatHref ? '/' : undefined}
    />
  )
}

export function CheckoutSuccessView({
  language,
  chatHref,
  escrowHint = null,
  successBody = null,
  successNextStep3 = null,
  listingCategorySlug = null,
  wizardProfile = null,
}) {
  const uiCtx = listingCategorySlug ? { listingCategorySlug, wizardProfile } : undefined
  const bodyText = successBody || getUIText('checkout_successBody', language, uiCtx)
  return (
    <StorefrontStateView
      variant="success"
      testId="checkout-success"
      className="min-h-screen bg-slate-50"
      title={getUIText('checkout_successTitle', language)}
      body={bodyText}
      primaryLabel={getUIText('checkout_successMyBookingsCta', language)}
      primaryHref="/my-bookings"
      secondaryLabel={chatHref ? getUIText('checkout_chatHost', language, uiCtx) : undefined}
      secondaryHref={chatHref || undefined}
      tertiaryLabel={getUIText('checkout_home', language)}
      tertiaryHref="/"
    >
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 space-y-3">
        <p className="text-sm font-semibold text-slate-900">
          {getUIText('checkout_successNextSteps_title', language)}
        </p>
        <ul className="space-y-3">
          {SUCCESS_NEXT_STEP_KEYS.map((key, index) => {
            const Icon = SUCCESS_NEXT_STEP_ICONS[index]
            const isHelpStep = key === 'checkout_successNextSteps_4'
            const isEscrowStep = key === 'checkout_successNextSteps_3'
            const stepText =
              isEscrowStep && successNextStep3
                ? successNextStep3
                : getUIText(key, language, uiCtx)
            return (
              <li key={key} className="flex gap-3 items-start text-sm text-slate-600 leading-relaxed">
                <Icon className="h-4 w-4 shrink-0 mt-0.5 text-brand" aria-hidden />
                <span>
                  {stepText}
                  {isHelpStep ? (
                    <>
                      {' '}
                      <Link
                        href="/help/escrow-protection"
                        className="font-medium text-brand hover:text-brand-hover underline underline-offset-2"
                      >
                        {getUIText('checkout_escrowInfoLink', language)}
                      </Link>
                    </>
                  ) : null}
                </span>
              </li>
            )
          })}
        </ul>
        {escrowHint ? (
          <p className="text-xs text-slate-500 leading-snug border-t border-slate-200/80 pt-3">
            {escrowHint}
          </p>
        ) : null}
      </div>
    </StorefrontStateView>
  )
}

/** Stage 138.2 — calm full-page state while polling acquirer return. */
export function CheckoutPaymentReturnVerifyingView({
  language,
  bookingId = null,
  chatHref = null,
}) {
  const bookingDetailsHref = bookingId
    ? `/my-bookings?booking=${encodeURIComponent(String(bookingId))}`
    : '/my-bookings'

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <Card className={cn(MOBILE_FLAT_CARD_CLASS, 'w-full max-w-md sm:border-slate-200/80')}>
        <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'space-y-4 text-center max-sm:py-8 sm:pb-8 sm:pt-8')}>
          <Loader2 className="h-12 w-12 animate-spin text-brand mx-auto" aria-hidden />
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-slate-900">
              {getUIText('checkout_returnVerifyingTitle', language)}
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              {getUIText('checkout_returnVerifyingBody', language)}
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <Button asChild variant="outline" className="min-h-[44px] w-full">
              <Link
                href={bookingDetailsHref}
                onClick={() => trackCheckoutEscapeClick('verifying_booking_details', bookingId)}
              >
                {getUIText('checkout_escapeBookingDetails', language)}
              </Link>
            </Button>
            {chatHref ? (
              <Button asChild variant="ghost" className="min-h-[44px] w-full text-brand">
                <Link
                  href={chatHref}
                  onClick={() => trackCheckoutEscapeClick('verifying_open_chat', bookingId)}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {getUIText('checkout_escapeOpenChat', language)}
                </Link>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Stage 138.2 / 198 — payment declined/cancelled or polling timeout after YooKassa return.
 * @param {{ language: string, chatHref?: string | null, onRetry: () => void, retrying?: boolean, failReason?: string | null }} props
 */
export function CheckoutPaymentFailedView({
  language,
  chatHref,
  onRetry,
  retrying = false,
  failReason = null,
  listingCategorySlug = null,
  wizardProfile = null,
}) {
  const supportHref = chatHref || '/help'
  const uiCtx = listingCategorySlug ? { listingCategorySlug, wizardProfile } : undefined
  const titleKey =
    failReason === 'timeout'
      ? 'checkout_failedTitleTimeout'
      : failReason === 'canceled'
        ? 'checkout_failedTitleCanceled'
        : failReason === 'declined'
          ? 'checkout_failedTitleDeclined'
          : 'checkout_failedTitle'
  const bodyKey =
    failReason === 'timeout'
      ? 'checkout_failedBodyTimeout'
      : failReason === 'canceled'
        ? 'checkout_failedBodyCanceled'
        : failReason === 'declined'
          ? 'checkout_failedBodyDeclined'
          : 'checkout_failedBody'

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <Card className={cn(MOBILE_FLAT_CARD_CLASS, 'w-full max-w-md sm:border-slate-200/80')}>
        <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'text-center max-sm:py-8 sm:pb-8 sm:pt-8')}>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 border border-amber-100">
            <CreditCard className="h-8 w-8 text-amber-700" aria-hidden />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2">
            {getUIText(titleKey, language)}
          </h3>
          <p className="text-slate-600 mb-6 leading-relaxed">
            {getUIText(bodyKey, language)}
          </p>
          <div className="space-y-3">
            <Button
              type="button"
              variant="brand"
              className="w-full min-h-[44px]"
              onClick={onRetry}
              disabled={retrying}
            >
              {retrying ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CreditCard className="h-4 w-4 mr-2" />
              )}
              {getUIText('checkout_failedRetry', language)}
            </Button>
            <Button asChild variant="outline" className="w-full min-h-[44px]">
              <Link href={supportHref}>
                <MessageSquare className="h-4 w-4 mr-2" />
                {chatHref
                  ? getUIText('checkout_chatHost', language, uiCtx)
                  : getUIText('checkout_failedSupport', language)}
              </Link>
            </Button>
            <Button asChild variant="ghost" className="w-full min-h-[44px] text-slate-600">
              <Link href="/my-bookings">{getUIText('checkout_myBookings', language)}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function CheckoutSuspenseFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="h-10 w-10 animate-spin text-brand" />
    </div>
  )
}
