'use client'

import { Suspense, use, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { CheckCircle2, CreditCard, Wallet, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { getUIText } from '@/lib/translations'
import { CancelBookingDialog } from '@/components/renter/cancel-booking-dialog'
import { useCheckoutPayment } from './hooks/useCheckoutPayment'
import { useCheckoutPricing } from './hooks/useCheckoutPricing'
import { CheckoutSummary } from './components/CheckoutSummary'
import { PaymentMethods } from './components/PaymentMethods'
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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link href="/" className="inline-flex items-center text-teal-600 hover:text-teal-700 mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {getUIText('checkout_back', c.language)}
        </Link>

        <h1 className="text-3xl font-bold text-slate-900 mb-8">{getUIText('checkout_title', c.language)}</h1>

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
          <PaymentMethods p={p} c={c} paymentMethodOptions={paymentMethodOptions} />
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
