/**
 * GoStayLo - In-Chat Invoice Component
 * Stage 110.6 — префилл = гостевая витрина + retail FX; гость видит сумму партнёра.
 */

'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Receipt,
  CreditCard,
  Wallet,
  Calendar,
  Home,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  DollarSign,
  Bitcoin,
} from 'lucide-react'
import { useCommission } from '@/hooks/use-commission'
import { fetchExchangeRates } from '@/lib/client-data'
import {
  resolveInvoicePrefillFromStorefront,
  convertDisplayAmountToThb,
  computeUsdtFromThbRetail,
  getInvoiceGuestAmountPresentation,
} from '@/lib/pricing/fx-display-client'
import { useCurrency } from '@/contexts/currency-context'

const CURRENCY_CONFIG = {
  THB: { symbol: '฿', icon: DollarSign, color: 'text-green-600', bgColor: 'bg-green-50' },
  USDT: { symbol: '$', icon: Bitcoin, color: 'text-amber-600', bgColor: 'bg-amber-50' },
  RUB: { symbol: '₽', icon: DollarSign, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  USD: { symbol: '$', icon: DollarSign, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
}

const METHOD_CURRENCY = {
  CRYPTO: 'USDT',
  USDT_TRC20: 'USDT',
  CARD: 'THB',
  CARD_INTL: 'USD',
  MIR: 'RUB',
  THAI_QR: 'THB',
}

const STATUS_CONFIG = {
  PENDING: { label: 'Ожидает оплаты', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  PAID: { label: 'Оплачен', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  EXPIRED: { label: 'Истёк', color: 'bg-gray-100 text-gray-800', icon: XCircle },
  CANCELLED: { label: 'Отменён', color: 'bg-red-100 text-red-800', icon: XCircle },
}

export function InvoiceCard({
  invoice,
  isOwn = false,
  onPay = null,
  paymentMethod = 'CRYPTO',
  language = 'ru',
}) {
  const { currency: guestUiCurrency } = useCurrency()
  const [rateMap, setRateMap] = useState({ THB: 1 })

  useEffect(() => {
    fetchExchangeRates({ retail: true }).then((m) => {
      if (m && typeof m === 'object') setRateMap(m)
    })
  }, [])

  const presentation = useMemo(
    () =>
      getInvoiceGuestAmountPresentation({
        invoice,
        guestUiCurrency,
        rateMap,
        language,
      }),
    [invoice, guestUiCurrency, rateMap, language],
  )

  const currency = METHOD_CURRENCY[paymentMethod] || 'THB'
  const currencyConfig = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.THB
  const statusConfig = STATUS_CONFIG[invoice?.status] || STATUS_CONFIG.PENDING
  const StatusIcon = statusConfig.icon
  const CurrencyIcon = currencyConfig.icon

  return (
    <Card className={`w-full max-w-sm ${isOwn ? 'ml-auto' : ''} border-2 border-brand/25 shadow-lg`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${currencyConfig.bgColor}`}>
              <CurrencyIcon className={`h-5 w-5 ${currencyConfig.color}`} />
            </div>
            <div>
              <p className="text-xs text-slate-500">Счёт на оплату</p>
              <p className="font-semibold text-slate-900">Invoice #{invoice?.id?.slice(-6) || 'NEW'}</p>
            </div>
          </div>
          <Badge className={statusConfig.color}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {statusConfig.label}
          </Badge>
        </div>

        {invoice?.listing && (
          <div className="flex items-center gap-2 mb-3 p-2 bg-slate-50 rounded-lg">
            <Home className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700 truncate">
              {invoice.listing.title || 'Объект'}
            </span>
          </div>
        )}

        {invoice?.check_in && invoice?.check_out && (
          <div className="flex items-center gap-2 mb-3 text-sm text-slate-600">
            <Calendar className="h-4 w-4" />
            <span>
              {invoice.check_in} — {invoice.check_out}
            </span>
          </div>
        )}

        <div className={`rounded-lg p-4 mb-3 ${currencyConfig.bgColor}`}>
          <p className="text-xs text-slate-600 mb-1">Сумма к оплате</p>
          <p className={`text-2xl font-bold ${currencyConfig.color}`}>{presentation.primary.label}</p>
          {presentation.secondary && (
            <p className="text-xs text-slate-500 mt-1">{presentation.secondary.label}</p>
          )}
        </div>

        {invoice?.description && (
          <p className="text-sm text-slate-600 mb-3 italic">&quot;{invoice.description}&quot;</p>
        )}

        {invoice?.status === 'PENDING' && onPay && !isOwn && (
          <Button
            onClick={() => onPay(invoice)}
            className="w-full bg-brand hover:bg-brand-hover"
            data-testid="invoice-pay-btn"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Оплатить
          </Button>
        )}

        {isOwn && invoice?.status === 'PENDING' && (
          <p className="text-xs text-center text-slate-500">Ожидаем оплату от гостя</p>
        )}
      </CardContent>
    </Card>
  )
}

export function SendInvoiceDialog({
  booking = null,
  listing = null,
  onSend,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}) {
  const commission = useCommission()
  const amountInputRef = useRef(null)
  const userEditedAmountRef = useRef(false)
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen
  const setOpen = controlledOnOpenChange || setUncontrolledOpen
  const [sending, setSending] = useState(false)
  const [exchangeRates, setExchangeRates] = useState({ THB: 1 })
  const [invoiceData, setInvoiceData] = useState({
    amount: '',
    currency: 'THB',
    description: '',
    paymentMethod: 'CARD',
    extensionIntent: false,
    newCheckOut: '',
  })

  const guestFeePercent =
    !commission.loading && Number.isFinite(commission.guestServiceFeePercent)
      ? Number(commission.guestServiceFeePercent)
      : undefined

  useEffect(() => {
    fetchExchangeRates({ retail: true }).then((m) => {
      if (m && typeof m === 'object') setExchangeRates(m)
    })
  }, [])

  const storefrontPrefill = useMemo(
    () =>
      resolveInvoicePrefillFromStorefront({
        booking,
        listing,
        currency: invoiceData.currency,
        rateMap: exchangeRates,
        guestServiceFeePercent: guestFeePercent,
      }),
    [booking, listing, invoiceData.currency, exchangeRates, guestFeePercent],
  )

  useEffect(() => {
    if (!open) {
      userEditedAmountRef.current = false
      return
    }
    const t = setTimeout(() => amountInputRef.current?.focus(), 10)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open || userEditedAmountRef.current) return
    if (!storefrontPrefill.amount) return
    setInvoiceData((prev) => ({
      ...prev,
      amount: storefrontPrefill.amount,
      currency: storefrontPrefill.currency,
    }))
  }, [open, storefrontPrefill.amount, storefrontPrefill.currency])

  const handleSend = async () => {
    if (!invoiceData.amount) return
    if (invoiceData.extensionIntent && !invoiceData.newCheckOut) return

    setSending(true)
    try {
      const payload = {
        amount: invoiceData.amount,
        currency: invoiceData.currency,
        description: invoiceData.description,
        paymentMethod: invoiceData.paymentMethod,
        booking_id: booking?.id,
        listing_id: listing?.id,
        listing_title: listing?.title,
        check_in: booking?.check_in,
        check_out: booking?.check_out,
      }
      if (invoiceData.extensionIntent) {
        const dt = new Date(invoiceData.newCheckOut)
        payload.intent = 'extension'
        payload.newCheckOut = Number.isFinite(dt.getTime())
          ? dt.toISOString()
          : invoiceData.newCheckOut
      }

      await onSend({ ...payload })
      setOpen(false)
      userEditedAmountRef.current = false
      setInvoiceData({
        amount: '',
        currency: 'THB',
        description: '',
        paymentMethod: 'CARD',
        extensionIntent: false,
        newCheckOut: '',
      })
    } catch (error) {
      console.error('Send invoice error:', error)
    } finally {
      setSending(false)
    }
  }

  const parsedAmount = parseFloat(invoiceData.amount) || 0
  const amountThbPreview =
    parsedAmount > 0
      ? convertDisplayAmountToThb(parsedAmount, invoiceData.currency, exchangeRates)
      : 0
  const usdtAmount =
    amountThbPreview > 0 ? computeUsdtFromThbRetail(amountThbPreview, exchangeRates) : null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : controlledOpen === undefined ? (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            <Receipt className="h-4 w-4" />
            Счёт
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-brand" />
            Создать счёт на оплату
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {listing && (
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-sm font-medium text-slate-900">{listing.title}</p>
              {booking && (
                <p className="text-xs text-slate-500 mt-1">
                  {booking.check_in} — {booking.check_out}
                </p>
              )}
            </div>
          )}

          <div>
            <Label>Сумма</Label>
            <div className="flex gap-2">
              <Input
                ref={amountInputRef}
                type="number"
                value={invoiceData.amount}
                onChange={(e) => {
                  userEditedAmountRef.current = true
                  setInvoiceData((prev) => ({ ...prev, amount: e.target.value }))
                }}
                placeholder="0"
                inputMode="decimal"
                className="flex-1"
              />
              <Select
                value={invoiceData.currency}
                onValueChange={(v) => {
                  setInvoiceData((prev) => {
                    if (userEditedAmountRef.current) {
                      return { ...prev, currency: v }
                    }
                    const next = resolveInvoicePrefillFromStorefront({
                      booking,
                      listing,
                      currency: v,
                      rateMap: exchangeRates,
                      guestServiceFeePercent: guestFeePercent,
                    })
                    return {
                      ...prev,
                      currency: v,
                      amount: next.amount || prev.amount,
                    }
                  })
                }}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="THB">฿ THB</SelectItem>
                  <SelectItem value="USDT">$ USDT</SelectItem>
                  <SelectItem value="RUB">₽ RUB</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {storefrontPrefill.guestThb > 0 && !userEditedAmountRef.current && (
              <p className="text-xs text-slate-500 mt-1">
                Ориентир с витрины: ฿{storefrontPrefill.guestThb.toLocaleString()} THB
              </p>
            )}
            {parsedAmount > 0 && usdtAmount != null && (
              <p className="text-xs text-slate-500 mt-1">≈ {usdtAmount} USDT</p>
            )}
          </div>

          <div>
            <Label>Способ оплаты</Label>
            <Select
              value={invoiceData.paymentMethod}
              onValueChange={(v) => setInvoiceData((prev) => ({ ...prev, paymentMethod: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CRYPTO">
                  <span className="flex items-center gap-2">
                    <Wallet className="h-4 w-4" /> USDT (TRC-20)
                  </span>
                </SelectItem>
                <SelectItem value="CARD">
                  <span className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" /> Карта (Visa/MC)
                  </span>
                </SelectItem>
                <SelectItem value="MIR">
                  <span className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" /> МИР
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Комментарий (опционально)</Label>
            <Input
              value={invoiceData.description}
              onChange={(e) => setInvoiceData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Оплата за проживание..."
            />
          </div>

          <div className="space-y-2 rounded-lg border border-slate-200 p-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="invoice-extension-intent"
                checked={!!invoiceData.extensionIntent}
                onCheckedChange={(checked) =>
                  setInvoiceData((prev) => ({ ...prev, extensionIntent: !!checked }))
                }
              />
              <Label htmlFor="invoice-extension-intent" className="cursor-pointer">
                Продление аренды (extension)
              </Label>
            </div>
            {invoiceData.extensionIntent && (
              <div className="space-y-1">
                <Label htmlFor="invoice-new-checkout">Новое время/дата возврата</Label>
                <Input
                  id="invoice-new-checkout"
                  type="datetime-local"
                  value={invoiceData.newCheckOut}
                  onChange={(e) =>
                    setInvoiceData((prev) => ({ ...prev, newCheckOut: e.target.value }))
                  }
                />
                <p className="text-xs text-slate-500">
                  Будет отправлено как metadata: intent=extension, new_check_out.
                </p>
              </div>
            )}
          </div>

          <Button
            onClick={handleSend}
            disabled={
              !invoiceData.amount ||
              (invoiceData.extensionIntent && !invoiceData.newCheckOut) ||
              sending
            }
            className="w-full bg-brand hover:bg-brand-hover"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Receipt className="h-4 w-4 mr-2" />
            )}
            Отправить счёт
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default { InvoiceCard, SendInvoiceDialog }
