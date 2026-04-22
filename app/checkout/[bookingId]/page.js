'use client'

import { Suspense, use, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  CreditCard,
  Wallet,
  Loader2,
  CheckCircle2,
  Copy,
  ExternalLink,
  AlertCircle,
  Smartphone,
} from 'lucide-react'
import { toast } from 'sonner'
import { getUIText } from '@/lib/translations'
import { QRCodeSVG } from 'qrcode.react'
import { CancelBookingDialog } from '@/components/renter/cancel-booking-dialog'
import { useCheckoutPayment } from './hooks/useCheckoutPayment'
import { useCheckoutPricing } from './hooks/useCheckoutPricing'

function canRenterCancelCheckout(status) {
  return !['CANCELLED', 'COMPLETED', 'REFUNDED', 'DECLINED'].includes(String(status || '').toUpperCase())
}

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
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-teal-600" />
      </div>
    )
  }

  if (p.accessDenied) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <h3 className="text-xl font-semibold mb-2">{getUIText('checkout_accessDeniedTitle', c.language)}</h3>
            <p className="text-slate-600 mb-4">{getUIText('checkout_accessDeniedBody', c.language)}</p>
            <div className="flex gap-2 justify-center">
              <Button asChild>
                <Link href="/">{getUIText('checkout_home', c.language)}</Link>
              </Button>
              <Button variant="outline" onClick={() => window.location.reload()}>
                {getUIText('checkout_refresh', c.language)}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!p.booking || p.booking.status === 'CANCELLED') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <h3 className="text-xl font-semibold mb-2">{getUIText('checkout_unavailableTitle', c.language)}</h3>
            <p className="text-slate-600 mb-4">{getUIText('checkout_unavailableBody', c.language)}</p>
            <Button asChild>
              <Link href="/">{getUIText('checkout_home', c.language)}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (p.paymentSuccess) {
    const chatHref = p.chatConversationId
      ? `/messages/${encodeURIComponent(p.chatConversationId)}`
      : null
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">{getUIText('checkout_successTitle', c.language)}</h3>
            <p className="text-slate-600 mb-6">{getUIText('checkout_successBody', c.language)}</p>
            <div className="space-y-3">
              {chatHref && (
                <Button asChild className="w-full bg-teal-600 hover:bg-teal-700">
                  <Link href={chatHref}>{getUIText('checkout_chatHost', c.language)}</Link>
                </Button>
              )}
              <Button
                asChild
                variant={chatHref ? 'outline' : 'default'}
                className={`w-full${chatHref ? '' : ' bg-teal-600 hover:bg-teal-700'}`}
              >
                <Link href="/">{getUIText('checkout_home', c.language)}</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/my-bookings">{getUIText('checkout_myBookings', c.language)}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (c.commissionLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
      </div>
    )
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
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{getUIText('checkout_selectMethod', c.language)}</CardTitle>
                {p.paymentIntent?.id && (
                  <p className="text-xs text-slate-500">
                    {c.language === 'ru'
                      ? `Методы из Payment Intent ${p.paymentIntent.id}`
                      : `Methods from Payment Intent ${p.paymentIntent.id}`}
                  </p>
                )}
                {p.invoice?.payment_method && (
                  <p className="text-xs text-slate-500">
                    {c.language === 'ru'
                      ? `Рекомендуемый способ по счёту: ${String(p.invoice.payment_method).toUpperCase()}`
                      : `Invoice-preferred method: ${String(p.invoice.payment_method).toUpperCase()}`}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <RadioGroup value={p.paymentMethod} onValueChange={p.setPaymentMethod}>
                  {paymentMethodOptions.map((opt) => {
                    const Icon = opt.icon
                    return (
                      <div
                        key={opt.value}
                        className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-slate-50 cursor-pointer"
                      >
                        <RadioGroupItem value={opt.value} id={opt.id} />
                        <Label htmlFor={opt.id} className="flex items-center gap-3 cursor-pointer flex-1">
                          <Icon className={`h-5 w-5 ${opt.iconClassName}`} />
                          <div>
                            <p className="font-semibold">{opt.title}</p>
                            <p className="text-sm text-slate-500">{opt.description}</p>
                          </div>
                        </Label>
                      </div>
                    )
                  })}
                </RadioGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{getUIText('checkout_promoTitle', c.language)}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    placeholder={getUIText('checkout_promoPlaceholder', c.language)}
                    value={c.promoCode}
                    onChange={(e) => c.setPromoCode(e.target.value.toUpperCase())}
                    disabled={c.promoDiscount !== null}
                    className="flex-1"
                  />
                  <Button
                    onClick={c.handleApplyPromoCode}
                    disabled={c.promoLoading || c.promoDiscount !== null || !c.promoCode.trim()}
                    variant="outline"
                  >
                    {c.promoLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : c.promoDiscount ? (
                      '✓'
                    ) : (
                      getUIText('checkout_apply', c.language)
                    )}
                  </Button>
                </div>
                {c.promoDiscount && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-medium text-green-900">
                      {c.interpolateTemplate(getUIText('checkout_applied', c.language), {
                        code: c.promoDiscount.code,
                      })}
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      −{c.formatDisplayPrice(c.promoDiscount.discountAmount, 'THB')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button
              onClick={p.handleInitiatePayment}
              disabled={p.processing || !p.paymentMethod}
              data-testid="checkout-pay-submit"
              className="w-full bg-teal-600 hover:bg-teal-700 h-12 text-lg"
            >
              {p.processing ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  {getUIText('checkout_payProcessing', c.language)}
                </>
              ) : (
                c.interpolateTemplate(getUIText('checkout_payCta', c.language), {
                  amount: c.payableText,
                })
              )}
            </Button>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{getUIText('checkout_orderTitle', c.language)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-semibold text-slate-900">{p.listing?.title}</p>
                  <p className="text-sm text-slate-600 mt-1">
                    {new Date(p.booking.checkIn).toLocaleDateString(c.dateNumberLocale)} –{' '}
                    {new Date(p.booking.checkOut).toLocaleDateString(c.dateNumberLocale)}
                  </p>
                  {p.invoice?.id && (
                    <p className="text-xs text-slate-500 mt-1">
                      Invoice #{String(p.invoice.id).slice(-8)} • {String(p.invoice.currency || 'THB').toUpperCase()}
                    </p>
                  )}
                </div>

                <div className="border-t pt-4 space-y-2">
                  {!c.hasInvoiceCheckout && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">{getUIText('checkout_subtotal', c.language)}</span>
                      <span
                        className="font-medium"
                        data-test-subtotal-value={c.priceRawForTest(p.booking.priceThb, 'THB')}
                      >
                        {c.formatDisplayPrice(p.booking.priceThb, 'THB')}
                      </span>
                    </div>
                  )}
                  {c.promoDiscount && !c.hasInvoiceCheckout && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span className="flex items-center gap-1">
                        {c.interpolateTemplate(getUIText('checkout_discountLine', c.language), {
                          code: c.promoDiscount.code,
                        })}
                      </span>
                      <span className="font-medium">−{c.formatDisplayPrice(c.discountAmount, 'THB')}</span>
                    </div>
                  )}
                  {!c.hasInvoiceCheckout && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">
                        {c.interpolateTemplate(getUIText('checkout_serviceFeeLine', c.language), {
                          pct: String(c.guestServiceFeePercent),
                        })}
                      </span>
                      <span
                        className="font-medium"
                        data-test-fee-value={c.priceRawForTest(c.serviceFee, 'THB')}
                      >
                        {c.formatDisplayPrice(c.serviceFee, 'THB')}
                      </span>
                    </div>
                  )}
                  {c.roundingDiffPot > 0 && !c.hasInvoiceCheckout && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Rounding pot</span>
                      <span className="font-medium">{c.formatDisplayPrice(c.roundingDiffPot, 'THB')}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>{getUIText('checkout_total', c.language)}</span>
                    <span
                      className="text-teal-600"
                      data-test-raw-value={
                        c.hasInvoiceCheckout
                          ? String(c.invoiceAmount)
                          : c.priceRawForTest(c.totalWithFee, 'THB')
                      }
                      data-test-total-thb={String(
                        Math.round(
                          Number(c.hasInvoiceCheckout ? p.invoice?.amount_thb || c.totalWithFee : c.totalWithFee) || 0,
                        ),
                      )}
                    >
                      {c.payableText}
                    </span>
                  </div>
                  {canRenterCancelCheckout(p.booking.status) && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full mt-3 border-red-200 text-red-700 hover:bg-red-50"
                      onClick={() => setCancelOpen(true)}
                    >
                      {getUIText('renterCancel_button', c.language)}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
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

        <Dialog open={p.cryptoModalOpen} onOpenChange={p.setCryptoModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-amber-600" />
                {getUIText('checkout_cryptoModalTitle', c.language)}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <span className="text-lg font-bold text-amber-800">
                    {getUIText('checkout_cryptoWarnTitle', c.language)}
                  </span>
                </div>
                <p className="text-sm text-amber-700">{getUIText('checkout_cryptoWarnBody', c.language)}</p>
              </div>

              <div className="flex flex-col items-center">
                <div className="bg-white p-4 rounded-xl border-2 border-slate-200 shadow-sm">
                  <QRCodeSVG
                    value={p.GOSTAYLO_WALLET}
                    size={180}
                    level="H"
                    includeMargin={true}
                    data-testid="wallet-qr-code"
                  />
                </div>
                <div className="mt-3 flex items-center gap-2 text-slate-600">
                  <Smartphone className="h-4 w-4" />
                  <span className="text-sm">{getUIText('checkout_scanHint', c.language)}</span>
                </div>
              </div>

              <div>
                <Label className="text-base font-semibold mb-2 block">
                  {getUIText('checkout_walletLabel', c.language)}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={p.GOSTAYLO_WALLET}
                    readOnly
                    className="font-mono text-sm bg-slate-50"
                    data-testid="usdt-wallet-address"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => p.copyToClipboard(p.GOSTAYLO_WALLET)}
                    data-testid="copy-wallet-btn"
                    className="flex items-center gap-1"
                  >
                    <Copy className="h-4 w-4" />
                    {getUIText('checkout_copy', c.language)}
                  </Button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                    {getUIText('checkout_networkBadge', c.language)}
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                    {getUIText('checkout_tokenBadge', c.language)}
                  </Badge>
                </div>
              </div>

              <div>
                <Label className="text-base font-semibold mb-2 block">
                  {getUIText('checkout_amountLabel', c.language)}
                </Label>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-2xl font-bold text-amber-900" data-testid="usdt-amount">
                    {p.payment?.metadata?.amount ??
                      (c.thbPerUsdt
                        ? Math.ceil((c.totalWithFee / c.thbPerUsdt) * 100) / 100
                        : '—')}{' '}
                    USDT
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    ≈ {c.formatDisplayPrice(c.totalWithFee, 'THB')}
                  </p>
                </div>
              </div>

              {p.txidSubmitted && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-green-900">
                        {getUIText('checkout_txidSentTitle', c.language)}
                      </p>
                      <p className="text-sm text-green-700 mt-1">
                        {getUIText('checkout_txidSentBody', c.language)}
                      </p>
                      <p className="text-xs text-green-600 mt-2 font-mono break-all">TXID: {p.txId}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button variant="outline" size="sm" asChild className="flex-1">
                      <a
                        href={`https://tronscan.org/#/transaction/${p.txId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1"
                      >
                        <ExternalLink className="h-4 w-4" />
                        {getUIText('checkout_viewExplorer', c.language)}
                      </a>
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1 bg-teal-600 hover:bg-teal-700"
                      onClick={() => p.setCryptoModalOpen(false)}
                    >
                      {getUIText('checkout_close', c.language)}
                    </Button>
                  </div>
                </div>
              )}

              {p.liveVerification && !p.txidSubmitted && (
                <div
                  className={`rounded-lg p-4 border ${
                    p.liveVerification.success
                      ? 'bg-green-50 border-green-200'
                      : p.liveVerification.status === 'PENDING'
                        ? 'bg-yellow-50 border-yellow-200'
                        : p.liveVerification.status === 'UNDERPAID'
                          ? 'bg-orange-50 border-orange-200'
                          : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {p.liveVerification.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : p.liveVerification.status === 'PENDING' ? (
                      <Loader2 className="h-5 w-5 text-yellow-600 animate-spin" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span
                      className={`font-semibold ${
                        p.liveVerification.success
                          ? 'text-green-800'
                          : p.liveVerification.status === 'PENDING'
                            ? 'text-yellow-800'
                            : p.liveVerification.status === 'UNDERPAID'
                              ? 'text-orange-800'
                              : 'text-red-800'
                      }`}
                    >
                      {p.liveVerification.badge?.labelRu ||
                        p.liveVerification.badge?.label ||
                        p.liveVerification.status}
                    </span>
                  </div>
                  {p.liveVerification.data && (
                    <div className="text-sm space-y-1">
                      <p>
                        {getUIText('checkout_verify_from', c.language)}{' '}
                        <code className="text-xs">{p.liveVerification.data.from}</code>
                      </p>
                      <p>
                        {getUIText('checkout_verify_to', c.language)}{' '}
                        <code className="text-xs">{p.liveVerification.data.to}</code>
                      </p>
                      {p.liveVerification.data.amount > 0 && (
                        <p>
                          {getUIText('checkout_verify_amount', c.language)}{' '}
                          <strong>
                            {p.liveVerification.data.amount} {p.liveVerification.data.token}
                          </strong>
                        </p>
                      )}
                      {p.liveVerification.amountVerification && (
                        <div
                          className={`mt-2 p-2 rounded ${
                            p.liveVerification.amountVerification.sufficient ? 'bg-green-100' : 'bg-red-100'
                          }`}
                        >
                          <p className="text-xs font-medium">
                            {getUIText('checkout_verify_received', c.language)}{' '}
                            {p.liveVerification.amountVerification.received} USDT
                          </p>
                          {p.liveVerification.amountVerification.expected && (
                            <p className="text-xs">
                              {getUIText('checkout_verify_expected', c.language)}{' '}
                              {p.liveVerification.amountVerification.expected} USDT
                            </p>
                          )}
                          {p.liveVerification.amountVerification.difference !== 0 && (
                            <p
                              className={`text-xs ${
                                p.liveVerification.amountVerification.difference > 0
                                  ? 'text-green-700'
                                  : 'text-red-700'
                              }`}
                            >
                              {getUIText('checkout_verify_diff', c.language)}{' '}
                              {p.liveVerification.amountVerification.difference > 0 ? '+' : ''}
                              {p.liveVerification.amountVerification.difference} USDT
                            </p>
                          )}
                        </div>
                      )}
                      {!p.liveVerification.data.isCorrectWallet && (
                        <p className="text-orange-600 font-medium">
                          ⚠️ {getUIText('checkout_verify_wrongWallet', c.language)}
                        </p>
                      )}
                    </div>
                  )}
                  {p.liveVerification.error && (
                    <p className="text-sm text-red-600">{p.liveVerification.error}</p>
                  )}
                </div>
              )}

              {!p.txidSubmitted && (
                <>
                  <div>
                    <Label htmlFor="txid" className="text-base font-semibold mb-2 block">
                      {getUIText('checkout_txidLabel', c.language)}
                    </Label>
                    <Input
                      id="txid"
                      value={p.txId}
                      onChange={(e) => {
                        p.setTxId(e.target.value)
                        p.setLiveVerification(null)
                      }}
                      placeholder={getUIText('checkout_txidPh', c.language)}
                      className="font-mono text-sm"
                      data-testid="txid-input"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      {getUIText('checkout_txidHelp', c.language)}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={p.handleVerifyTxid}
                      disabled={!p.txId.trim() || p.txId.length < 60 || p.verifying}
                      className="flex-1"
                      data-testid="verify-txid-btn"
                    >
                      {p.verifying ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {getUIText('checkout_verifying', c.language)}
                        </>
                      ) : (
                        <>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          {getUIText('checkout_verifyBtn', c.language)}
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={p.handleSubmitTxid}
                      disabled={!p.txId.trim() || p.txId.length < 60 || p.verifying}
                      className="flex-1 bg-teal-600 hover:bg-teal-700"
                      data-testid="submit-txid-btn"
                    >
                      {getUIText('checkout_submitTxid', c.language)}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

export default function CheckoutPage({ params }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
        </div>
      }
    >
      <CheckoutPageInner params={params} />
    </Suspense>
  )
}
