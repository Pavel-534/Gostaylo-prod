'use client'

import Link from 'next/link'
import {
  CheckCircle2,
  CreditCard,
  Loader2,
  MessageSquare,
  CalendarRange,
  Shield,
  HelpCircle,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'
import { trackProductEvent, ProductAnalyticsEvents } from '@/lib/analytics/product-analytics.js'

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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loader2 className="h-12 w-12 animate-spin text-teal-600" />
    </div>
  )
}

export function CheckoutAccessDeniedView({ language }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Card className="max-w-md">
        <CardContent className="pt-6 text-center">
          <h3 className="text-xl font-semibold mb-2">{getUIText('checkout_accessDeniedTitle', language)}</h3>
          <p className="text-slate-600 mb-4">{getUIText('checkout_accessDeniedBody', language)}</p>
          <div className="flex gap-2 justify-center">
            <Button asChild>
              <Link href="/">{getUIText('checkout_home', language)}</Link>
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              {getUIText('checkout_refresh', language)}
            </Button>
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          <h3 className="text-xl font-semibold mb-2">{getUIText('checkout_unavailableTitle', language)}</h3>
          <p className="text-slate-600 mb-4">{getUIText('checkout_unavailableBody', language)}</p>
          <div className="flex flex-col gap-2">
            <Button asChild variant="brand">
              <Link
                href={bookingDetailsHref}
                onClick={() => trackCheckoutEscapeClick('unavailable_booking_details', bookingId)}
              >
                {getUIText('checkout_escapeBookingDetails', language)}
              </Link>
            </Button>
            {chatHref ? (
              <Button asChild variant="outline">
                <Link
                  href={chatHref}
                  onClick={() => trackCheckoutEscapeClick('unavailable_open_chat', bookingId)}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {getUIText('checkout_escapeOpenChat', language)}
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="ghost" className="text-slate-600">
              <Link href="/">{getUIText('checkout_home', language)}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <Card className="max-w-md w-full border-slate-200/80 shadow-sm">
        <CardContent className="pt-8 pb-8 text-center">
          <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" aria-hidden />
          <h3 className="text-2xl font-bold mb-2 text-slate-900">
            {getUIText('checkout_successTitle', language)}
          </h3>
          <p className="text-slate-600 mb-5 leading-relaxed">{bodyText}</p>
          <div className="text-left rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 mb-6 space-y-3">
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
          <div className="space-y-3">
            <Button asChild variant="brand" size="lg" className="w-full font-semibold shadow-sm">
              <Link href="/my-bookings">{getUIText('checkout_successMyBookingsCta', language)}</Link>
            </Button>
            {chatHref ? (
              <Button
                asChild
                variant="outline"
                size="lg"
                className="w-full border-brand/30 text-brand hover:bg-brand/5 font-semibold"
              >
                <Link href={chatHref}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {getUIText('checkout_chatHost', language, uiCtx)}
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="ghost" className="w-full text-slate-600">
              <Link href="/">{getUIText('checkout_home', language)}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
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
      <Card className="max-w-md w-full border-slate-200/80 shadow-sm">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
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
            <Button asChild variant="outline" size="sm">
              <Link
                href={bookingDetailsHref}
                onClick={() => trackCheckoutEscapeClick('verifying_booking_details', bookingId)}
              >
                {getUIText('checkout_escapeBookingDetails', language)}
              </Link>
            </Button>
            {chatHref ? (
              <Button asChild variant="ghost" size="sm" className="text-brand">
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
 * Stage 138.2 — payment declined/cancelled or polling timeout after YooKassa return.
 * @param {{ language: string, chatHref?: string | null, onRetry: () => void, retrying?: boolean }} props
 */
export function CheckoutPaymentFailedView({
  language,
  chatHref,
  onRetry,
  retrying = false,
  listingCategorySlug = null,
  wizardProfile = null,
}) {
  const supportHref = chatHref || '/help'
  const uiCtx = listingCategorySlug ? { listingCategorySlug, wizardProfile } : undefined

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <Card className="max-w-md w-full border-slate-200/80 shadow-sm">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 border border-amber-100">
            <CreditCard className="h-8 w-8 text-amber-700" aria-hidden />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2">
            {getUIText('checkout_failedTitle', language)}
          </h3>
          <p className="text-slate-600 mb-6 leading-relaxed">
            {getUIText('checkout_failedBody', language)}
          </p>
          <div className="space-y-3">
            <Button
              type="button"
              variant="brand"
              className="w-full"
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
            <Button asChild variant="outline" className="w-full">
              <Link href={supportHref}>
                <MessageSquare className="h-4 w-4 mr-2" />
                {chatHref
                  ? getUIText('checkout_chatHost', language, uiCtx)
                  : getUIText('checkout_failedSupport', language)}
              </Link>
            </Button>
            <Button asChild variant="ghost" className="w-full text-slate-600">
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
      <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
    </div>
  )
}
