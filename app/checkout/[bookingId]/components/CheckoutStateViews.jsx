'use client'

import Link from 'next/link'
import { CheckCircle2, CreditCard, Loader2, MessageSquare } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'

export function CheckoutFullPageSpinner() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loader2 className="h-12 w-12 animate-spin text-teal-600" />
    </div>
  )
}

export function CheckoutCommissionSpinner() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
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

export function CheckoutUnavailableView({ language }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Card className="max-w-md">
        <CardContent className="pt-6 text-center">
          <h3 className="text-xl font-semibold mb-2">{getUIText('checkout_unavailableTitle', language)}</h3>
          <p className="text-slate-600 mb-4">{getUIText('checkout_unavailableBody', language)}</p>
          <Button asChild>
            <Link href="/">{getUIText('checkout_home', language)}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export function CheckoutSuccessView({ language, chatHref }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Card className="max-w-md w-full mx-4">
        <CardContent className="pt-6 text-center">
          <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
          <h3 className="text-2xl font-bold mb-2">{getUIText('checkout_successTitle', language)}</h3>
          <p className="text-slate-600 mb-6">{getUIText('checkout_successBody', language)}</p>
          <div className="space-y-3">
            <Button asChild variant="brand" className="w-full">
              <Link href="/my-bookings">{getUIText('checkout_myBookings', language)}</Link>
            </Button>
            {chatHref && (
              <Button asChild variant="outline" className="w-full">
                <Link href={chatHref}>{getUIText('checkout_chatHost', language)}</Link>
              </Button>
            )}
            <Button asChild variant="outline" className="w-full">
              <Link href="/">{getUIText('checkout_home', language)}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/** Stage 138.2 — calm full-page state while polling acquirer return. */
export function CheckoutPaymentReturnVerifyingView({ language }) {
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
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Stage 138.2 — payment declined/cancelled or polling timeout after YooKassa return.
 * @param {{ language: string, chatHref?: string | null, onRetry: () => void, retrying?: boolean }} props
 */
export function CheckoutPaymentFailedView({ language, chatHref, onRetry, retrying = false }) {
  const supportHref = chatHref || '/help'

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
                  ? getUIText('checkout_chatHost', language)
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
