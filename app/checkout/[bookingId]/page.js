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
import { isBookingPayable } from '@/lib/booking/booking-status-rules'
import {
  getPayoutReleaseConfig,
  getPayoutReleaseDisplayText,
} from '@/lib/booking/payout-release-config.js'
import {
  CheckoutFullPageSpinner,
  CheckoutCommissionSpinner,
  CheckoutAccessDeniedView,
  CheckoutUnavailableView,
  CheckoutSuccessView,
  CheckoutPaymentFailedView,
  CheckoutPaymentReturnVerifyingView,
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
  const listingCategorySlug =
    p.listing?.category_slug ||
    p.booking?.listings?.category_slug ||
    p.booking?.listings?.metadata?.category_slug ||
    null
  const checkoutUiCtx = listingCategorySlug
    ? {
        listingCategorySlug,
        wizardProfile:
          p.listing?.wizard_profile || p.booking?.listings?.categories?.wizard_profile || null,
      }
    : undefined
  const bookingStatus = String(p.booking?.status || '').toUpperCase()
  const bookingAlreadyPaid = ['PAID', 'PAID_ESCROW', 'COMPLETED'].includes(bookingStatus)
  const checkoutChatHref = p.chatConversationId
    ? `/messages/${encodeURIComponent(p.chatConversationId)}`
    : null
  if (
    !p.booking ||
    bookingStatus === 'CANCELLED' ||
    (!p.paymentSuccess &&
      !p.paymentReturnVerifying &&
      !p.paymentFailed &&
      !isBookingPayable(bookingStatus) &&
      !bookingAlreadyPaid)
  ) {
    return (
      <CheckoutUnavailableView
        language={c.language}
        bookingId={params.bookingId}
        chatHref={checkoutChatHref}
      />
    )
  }
  if (p.paymentSuccess) {
    const chatBase = p.chatConversationId
      ? `/messages/${encodeURIComponent(p.chatConversationId)}`
      : null
    const resolvedInvoiceId =
      invoiceIdParam ||
      p.invoice?.id ||
      p.paymentIntent?.invoiceId ||
      p.booking?.metadata?.invoiceId ||
      null
    const chatHref = chatBase
      ? resolvedInvoiceId
        ? `${chatBase}?invoicePaid=${encodeURIComponent(String(resolvedInvoiceId))}&fromPayment=1`
        : `${chatBase}?fromPayment=1`
      : null
    const releaseConfig = listingCategorySlug
      ? getPayoutReleaseConfig({ categorySlug: listingCategorySlug })
      : null
    const escrowHint = releaseConfig
      ? getPayoutReleaseDisplayText(releaseConfig, c.language, 'protected')
      : null
    const successBody = releaseConfig
      ? getPayoutReleaseDisplayText(releaseConfig, c.language, 'guestEscrowSuccess')
      : null
    const successNextStep3 = releaseConfig
      ? getPayoutReleaseDisplayText(releaseConfig, c.language, 'guestEscrowStep3')
      : null
    return (
      <CheckoutSuccessView
        language={c.language}
        chatHref={chatHref}
        escrowHint={escrowHint}
        successBody={successBody}
        successNextStep3={successNextStep3}
        listingCategorySlug={listingCategorySlug}
      />
    )
  }
  if (p.paymentReturnVerifying) {
    return (
      <CheckoutPaymentReturnVerifyingView
        language={c.language}
        bookingId={params.bookingId}
        chatHref={checkoutChatHref}
      />
    )
  }
  if (p.paymentFailed) {
    const chatHref = p.chatConversationId ? `/messages/${encodeURIComponent(p.chatConversationId)}` : null
    return (
      <CheckoutPaymentFailedView
        language={c.language}
        chatHref={chatHref}
        listingCategorySlug={listingCategorySlug}
        wizardProfile={checkoutUiCtx?.wizardProfile}
        retrying={p.processing}
        onRetry={() => {
          p.clearPaymentFailed()
          void p.handleInitiatePayment()
        }}
      />
    )
  }
  if (c.commissionLoading) {
    return <CheckoutCommissionSpinner />
  }

  const tCheckout = (key) => getUIText(key, c.language, checkoutUiCtx)

  const flowT = (key) => getUIText(key, c.language)

  return (
    <div className="gsl-page">
      <div className="mx-auto max-w-4xl px-3 sm:px-4 py-6 sm:py-8 space-y-5">
        <GuestBookingFlowHint t={flowT} />
        <Link href="/" className="inline-flex items-center text-brand hover:text-brand-hover text-sm font-medium">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {tCheckout('checkout_back')}
        </Link>

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{tCheckout('checkout_title')}</h1>

        <div className="rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-3 flex gap-3 items-start">
          <Shield className="h-5 w-5 text-sky-700 shrink-0 mt-0.5" aria-hidden />
          <div className="text-sm text-slate-800 space-y-1">
            <p className="font-semibold text-slate-900">{tCheckout('checkout_escrowInfoTitle')}</p>
            <p className="leading-relaxed">{tCheckout('checkout_escrowInfoBody')}</p>
            <Link
              href="/help/escrow-protection"
              className="inline-block font-medium text-brand hover:text-brand-hover underline underline-offset-2"
            >
              {tCheckout('checkout_escrowInfoLink')}
            </Link>
          </div>
        </div>

        {isBookingPayable(p.booking?.status) && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-emerald-900 text-sm">
                {tCheckout('checkout_confirmedBannerTitle')}
              </p>
              <p className="text-sm text-emerald-700 mt-0.5">
                {tCheckout('checkout_confirmedBannerBody')}
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
