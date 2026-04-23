'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { CreditCard, Wallet, Loader2, CheckCircle2, Copy, ExternalLink, AlertCircle, Smartphone } from 'lucide-react'
import { getUIText } from '@/lib/translations'
import { QRCodeSVG } from 'qrcode.react'

/**
 * @param {object} p — useCheckoutPayment
 * @param {object} c — useCheckoutPricing
 * @param {Array} paymentMethodOptions — built in page (icons + i18n labels)
 */
export function PaymentMethods({ p, c, paymentMethodOptions }) {
  return (
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
              <p className="text-xs text-green-700 mt-1">−{c.formatDisplayPrice(c.promoDiscount.discountAmount, 'THB')}</p>
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
                    (c.thbPerUsdt ? Math.ceil((c.totalWithFee / c.thbPerUsdt) * 100) / 100 : '—')}{' '}
                  USDT
                </p>
                <p className="text-sm text-amber-700 mt-1">≈ {c.formatDisplayPrice(c.totalWithFee, 'THB')}</p>
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
                    <p className="text-sm text-green-700 mt-1">{getUIText('checkout_txidSentBody', c.language)}</p>
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
                      {getUIText('checkout_verify_to', c.language)} <code className="text-xs">{p.liveVerification.data.to}</code>
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
                          {getUIText('checkout_verify_received', c.language)} {p.liveVerification.amountVerification.received}{' '}
                          USDT
                        </p>
                        {p.liveVerification.amountVerification.expected && (
                          <p className="text-xs">
                            {getUIText('checkout_verify_expected', c.language)} {p.liveVerification.amountVerification.expected}{' '}
                            USDT
                          </p>
                        )}
                        {p.liveVerification.amountVerification.difference !== 0 && (
                          <p
                            className={`text-xs ${
                              p.liveVerification.amountVerification.difference > 0 ? 'text-green-700' : 'text-red-700'
                            }`}
                          >
                            {getUIText('checkout_verify_diff', c.language)} {p.liveVerification.amountVerification.difference > 0 ? '+' : ''}
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
                {p.liveVerification.error && <p className="text-sm text-red-600">{p.liveVerification.error}</p>}
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
                  <p className="text-xs text-slate-500 mt-1">{getUIText('checkout_txidHelp', c.language)}</p>
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
  )
}
