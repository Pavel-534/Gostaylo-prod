'use client'

import { Suspense, use, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { useCurrency } from '@/contexts/currency-context'
import { CheckCircle2, CreditCard, Wallet, ArrowLeft, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { getUIText } from '@/lib/translations'
import { CancelBookingDialog } from '@/components/renter/cancel-booking-dialog'
import { useCheckoutPayment } from './hooks/useCheckoutPayment'
import { useCheckoutPricing } from './hooks/useCheckoutPricing'
import { CheckoutSummary } from './components/CheckoutSummary'
import { PaymentMethods } from './components/PaymentMethods'
import { GuestBookingFlowHint } from '@/components/product/GuestBookingFlowHint'
import {
  CheckoutFullPageSpinner,
  CheckoutCommissionSpinner,
  CheckoutAccessDeniedView,
  CheckoutUnavailableView,
  CheckoutSuccessView,
  CheckoutSuspenseFallback,
} from './components/CheckoutStateViews'

function CheckoutPageInner({ params: paramsProp }) {
  const params = typeof paramsProp?.then === 'function' ? use(paramsProp) : paramsProp
  const searchParams = useSearchParams()
  const invoiceIdParam = searchParams.get('invoiceId')
  const { user, loading: authLoading } = useAuth()
  const { currency: guestUiCurrency } = useCurrency()
  const [cancelOpen, setCancelOpen] = useState(false)

  const p = useCheckoutPayment({
    bookingId: params.bookingId,
    invoiceIdParam,
    user,
    authLoading,
  })

  const c = useCheckoutPricing({
    booking: p.booking,
    invoice: p.invoice,
    paymentMethod: p.paymentMethod,
    setPaymentMethod: p.setPaymentMethod,
    allowedMethods: p.allowedMethods,
    language: p.language,
    walletUseThb: p.walletUseThb,
    guestUiCurrency,
  })

  const paymentMethodOptions = [
    {
      value: 'CARD',
      id: 'card',
      icon: CreditCard,
      iconClassName: 'text-slate-600',
      title: getUIText('checkout_methodCard', c.language),
      description: getUIText('checkout_methodCardDesc', c.language),
    },
    {
      value: 'MIR',
      id: 'mir',
      icon: CreditCard,
      iconClassName: 'text-blue-600',
      title: getUIText('checkout_methodMir', c.language),
      description: getUIText('checkout_methodMirDesc', c.language),
    },
    {
      value: 'CRYPTO',
      id: 'crypto',
      icon: Wallet,
      iconClassName: 'text-amber-600',
      title: getUIText('checkout_methodCrypto', c.language),
      description: getUIText('checkout_methodCryptoDesc', c.language),
    },
  ].filter((opt) => p.allowedMethods.includes(opt.value))

  if (p.loading || authLoading) {
    return <CheckoutFullPageSpinner />
  }
  if (p.accessDenied) {
    return <CheckoutAccessDeniedView language={c.language} />
  }
  if (!p.booking || p.booking.status === 'CANCELLED') {
    return <CheckoutUnavailableView language={c.language} />
  }
  if (p.paymentSuccess) {
    const chatHref = p.chatConversationId ? `/messages/${encodeURIComponent(p.chatConversationId)}` : null
    return <CheckoutSuccessView language={c.language} chatHref={chatHref} />
  }
  if (c.commissionLoading) {
    return <CheckoutCommissionSpinner />
  }

  const flowT = (key) => getUIText(key, c.language)

  return (
    <div className="gsl-page">
      <div className="mx-auto max-w-4xl px-3 sm:px-4 py-6 sm:py-8 space-y-5">
        <GuestBookingFlowHint t={flowT} />
        <Link href="/" className="inline-flex items-center text-brand hover:text-brand-hover text-sm font-medium">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {getUIText('checkout_back', c.language)}
        </Link>

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{getUIText('checkout_title', c.language)}</h1>

        <div className="rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-3 flex gap-3 items-start">
          <Shield className="h-5 w-5 text-sky-700 shrink-0 mt-0.5" aria-hidden />
          <div className="text-sm text-slate-800 space-y-1">
            <p className="font-semibold text-slate-900">{getUIText('checkout_escrowInfoTitle', c.language)}</p>
            <p className="leading-relaxed">{getUIText('checkout_escrowInfoBody', c.language)}</p>
            <Link
              href="/help/escrow-protection"
              className="inline-block font-medium text-brand hover:text-brand-hover underline underline-offset-2"
            >
              {getUIText('checkout_escrowInfoLink', c.language)}
            </Link>
          </div>
        </div>

        {p.booking?.status === 'CONFIRMED' && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-emerald-900 text-sm">
                {getUIText('checkout_confirmedBannerTitle', c.language)}
              </p>
              <p className="text-sm text-emerald-700 mt-0.5">
                {getUIText('checkout_confirmedBannerBody', c.language)}
              </p>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          <PaymentMethods
            p={p}
            c={c}
            paymentMethodOptions={paymentMethodOptions}
          />
          <CheckoutSummary p={p} c={c} onOpenCancel={() => setCancelOpen(true)} />
        </div>

        <CancelBookingDialog
          open={cancelOpen}
          onOpenChange={setCancelOpen}
          bookingId={params?.bookingId}
          language={c.language}
          onCancelled={() => {
            p.loadPaymentStatus()
            toast.success(c.language === 'ru' ? 'Бронирование отменено' : 'Booking cancelled')
          }}
        />
      </div>
    </div>
  )
}

export default function CheckoutPage({ params }) {
  return (
    <Suspense fallback={<CheckoutSuspenseFallback />}>
      <CheckoutPageInner params={params} />
    </Suspense>
  )
}
