'use client'

import Link from 'next/link'
import { CheckCircle2, Loader2 } from 'lucide-react'
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
            {chatHref && (
              <Button asChild className="w-full bg-teal-600 hover:bg-teal-700">
                <Link href={chatHref}>{getUIText('checkout_chatHost', language)}</Link>
              </Button>
            )}
            <Button
              asChild
              variant={chatHref ? 'outline' : 'default'}
              className={`w-full${chatHref ? '' : ' bg-teal-600 hover:bg-teal-700'}`}
            >
              <Link href="/">{getUIText('checkout_home', language)}</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
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
