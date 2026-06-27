/**
 * GoStayLo - In-Chat Invoice Component
 * Stage 110.6 — префилл = гостевая витрина + retail FX; гость видит сумму партнёра.
 */

'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { format } from 'date-fns'
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
import { getUIText } from '@/lib/translations'
import { PlatformCalendar } from '@/components/platform-calendar'
import { getListingRentalPeriodMode } from '@/lib/listing-booking-ui'

function toInvoiceYmd(value) {
  if (!value) return null
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return format(value, 'yyyy-MM-dd')
  }
  const s = String(value).trim()
  if (!s) return null
  return s.length >= 10 ? s.slice(0, 10) : s
}

function formatStayLabel(checkIn, checkOut) {
  const a = toInvoiceYmd(checkIn)
  const b = toInvoiceYmd(checkOut)
  if (!a || !b) return ''
  return `${a} — ${b}`
}

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

const INVOICE_STATUS_STYLES = {
  PENDING: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, labelKey: 'invoiceStatus_pending' },
  PAID: { color: 'bg-green-100 text-green-800', icon: CheckCircle, labelKey: 'invoiceStatus_paid' },
  EXPIRED: { color: 'bg-gray-100 text-gray-800', icon: XCircle, labelKey: 'invoiceStatus_expired' },
  CANCELLED: { color: 'bg-red-100 text-red-800', icon: XCircle, labelKey: 'invoiceStatus_cancelled' },
}

/** Shared invoice status label + badge styles (Stage 172.1.6). */
export function resolveInvoiceStatusPresentation(status, language = 'ru') {
  const key = String(status || 'PENDING').toUpperCase()
  const style = INVOICE_STATUS_STYLES[key] || INVOICE_STATUS_STYLES.PENDING
  return {
    ...style,
    label: getUIText(style.labelKey, language),
  }
}

function isManualStayRangeInvalid(from, to) {
  if (!from || !to) return false
  const checkIn = toInvoiceYmd(from)
  const checkOut = toInvoiceYmd(to)
  if (!checkIn || !checkOut) return false
  return checkOut <= checkIn
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

  const tx = (key, extras) => getUIText(key, language, extras)
  const currency = METHOD_CURRENCY[paymentMethod] || 'THB'
  const currencyConfig = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.THB
  const statusConfig = useMemo(
    () => resolveInvoiceStatusPresentation(invoice?.status, language),
    [invoice?.status, language],
  )
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
              <p className="text-xs text-slate-500">{tx('invoiceCard_heading')}</p>
              <p className="font-semibold text-slate-900">
                {tx('invoiceCard_referenceLabel')} #{invoice?.id?.slice(-6) || 'NEW'}
              </p>
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
              {invoice.listing.title || tx('invoiceCard_listingFallback')}
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
          <p className="text-xs text-slate-600 mb-1">{tx('invoiceCard_amountDue')}</p>
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
            {tx('invoiceCard_payButton')}
          </Button>
        )}

        {isOwn && invoice?.status === 'PENDING' && (
          <p className="text-xs text-center text-slate-500">{tx('invoiceCard_awaitingGuest')}</p>
        )}
      </CardContent>
    </Card>
  )
}

export function SendInvoiceDialog({
  booking = null,
  listing = null,
  language = 'ru',
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
  const [stayRange, setStayRange] = useState({ from: null, to: null })
  const [invoiceData, setInvoiceData] = useState({
    amount: '',
    currency: 'THB',
    description: '',
    paymentMethod: 'CARD',
    extensionIntent: false,
    newCheckOut: '',
  })

  const tx = (key, extras) => getUIText(key, language, extras)
  const needsManualDates = !booking?.id
  const hasManualDates = !!(stayRange?.from && stayRange?.to)
  const manualDatesInvalid = useMemo(
    () => needsManualDates && hasManualDates && isManualStayRangeInvalid(stayRange.from, stayRange.to),
    [needsManualDates, hasManualDates, stayRange.from, stayRange.to],
  )

  const bookingForPrefill = useMemo(() => {
    if (booking) return booking
    if (!hasManualDates) return null
    return {
      check_in: toInvoiceYmd(stayRange.from),
      check_out: toInvoiceYmd(stayRange.to),
    }
  }, [booking, hasManualDates, stayRange.from, stayRange.to])

  const listingCategorySlug = useMemo(
    () =>
      listing?.category_slug ||
      listing?.categorySlug ||
      listing?.category?.slug ||
      null,
    [listing],
  )
  const rentalPeriodMode = getListingRentalPeriodMode(listingCategorySlug)

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
        booking: bookingForPrefill,
        listing,
        currency: invoiceData.currency,
        rateMap: exchangeRates,
        guestServiceFeePercent: guestFeePercent,
      }),
    [bookingForPrefill, listing, invoiceData.currency, exchangeRates, guestFeePercent],
  )

  useEffect(() => {
    if (!open) {
      userEditedAmountRef.current = false
      setStayRange({ from: null, to: null })
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

    const checkInVal = booking?.check_in
      ? toInvoiceYmd(booking.check_in)
      : toInvoiceYmd(stayRange.from)
    const checkOutVal = booking?.check_out
      ? toInvoiceYmd(booking.check_out)
      : toInvoiceYmd(stayRange.to)

    if (needsManualDates && (!checkInVal || !checkOutVal)) return
    if (needsManualDates && isManualStayRangeInvalid(stayRange.from, stayRange.to)) return

    setSending(true)
    try {
      const payload = {
        amount: invoiceData.amount,
        currency: invoiceData.currency,
        description: invoiceData.description,
        paymentMethod: invoiceData.paymentMethod,
        booking_id: booking?.id ?? null,
        bookingId: booking?.id ?? null,
        listing_id: listing?.id ?? null,
        listingId: listing?.id ?? null,
        listing_title: listing?.title ?? null,
        listingTitle: listing?.title ?? null,
        check_in: checkInVal,
        check_out: checkOutVal,
        checkIn: checkInVal,
        checkOut: checkOutVal,
      }
      if (invoiceData.extensionIntent) {
        const dt = new Date(invoiceData.newCheckOut)
        payload.intent = 'extension'
        payload.newCheckOut = Number.isFinite(dt.getTime())
          ? dt.toISOString()
          : invoiceData.newCheckOut
      }

      const outcome = await onSend?.({ ...payload })
      if (outcome?.ok === false) return

      setOpen(false)
      userEditedAmountRef.current = false
      setStayRange({ from: null, to: null })
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

  const sendDisabled =
    !invoiceData.amount ||
    (invoiceData.extensionIntent && !invoiceData.newCheckOut) ||
    (needsManualDates && !hasManualDates) ||
    manualDatesInvalid ||
    sending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : controlledOpen === undefined ? (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            <Receipt className="h-4 w-4" />
            {tx('chatInvoice_triggerLabel')}
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent className="max-w-md max-h-[min(92dvh,720px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-brand" />
            {tx('chatInvoice_dialogTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {listing && (
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-sm font-medium text-slate-900">{listing.title}</p>
              {booking?.check_in && booking?.check_out ? (
                <p className="text-xs text-slate-500 mt-1">
                  <span className="font-medium text-slate-600">
                    {tx('chatInvoice_bookingDatesReadonly')}:{' '}
                  </span>
                  {formatStayLabel(booking.check_in, booking.check_out)}
                </p>
              ) : null}
            </div>
          )}

          {needsManualDates ? (
            <div className="space-y-2 rounded-lg border border-slate-200 p-3">
              <div>
                <Label className="text-sm font-medium">{tx('chatInvoice_stayDatesSectionLabel')}</Label>
                <p className="text-xs text-slate-500 mt-1">{tx('chatInvoice_stayDatesRequiredHint')}</p>
              </div>
              {listing?.id ? (
                <div className="max-h-[280px] overflow-y-auto rounded-xl border border-slate-100">
                  <PlatformCalendar
                    listingId={listing.id}
                    value={stayRange}
                    onChange={setStayRange}
                    language={language}
                    guests={1}
                    listingMaxCapacity={listing.maxCapacity ?? listing.max_capacity ?? null}
                    rentalPeriodMode={rentalPeriodMode}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="chat-invoice-check-in">{tx('chatInvoice_checkInLabel')}</Label>
                    <Input
                      id="chat-invoice-check-in"
                      type="date"
                      value={stayRange.from ? toInvoiceYmd(stayRange.from) : ''}
                      onChange={(e) => {
                        const v = e.target.value
                        setStayRange((prev) => ({
                          ...prev,
                          from: v ? new Date(`${v}T00:00:00`) : null,
                        }))
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="chat-invoice-check-out">{tx('chatInvoice_checkOutLabel')}</Label>
                    <Input
                      id="chat-invoice-check-out"
                      type="date"
                      value={stayRange.to ? toInvoiceYmd(stayRange.to) : ''}
                      onChange={(e) => {
                        const v = e.target.value
                        setStayRange((prev) => ({
                          ...prev,
                          to: v ? new Date(`${v}T00:00:00`) : null,
                        }))
                      }}
                    />
                  </div>
                </div>
              )}
              {manualDatesInvalid ? (
                <p className="text-xs font-medium text-red-600" role="alert">
                  {tx('chatInvoice_stayDatesInvalid')}
                </p>
              ) : null}
            </div>
          ) : null}

          <div>
            <Label>{tx('chatInvoice_amountLabel')}</Label>
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
                      booking: bookingForPrefill,
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
                {tx('chatInvoice_storefrontHint', {
                  amount: storefrontPrefill.guestThb.toLocaleString(),
                })}
              </p>
            )}
            {parsedAmount > 0 && usdtAmount != null && (
              <p className="text-xs text-slate-500 mt-1">≈ {usdtAmount} USDT</p>
            )}
          </div>

          <div>
            <Label>{tx('chatInvoice_paymentMethodLabel')}</Label>
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
                    <Wallet className="h-4 w-4" /> {tx('chatInvoice_methodCrypto')}
                  </span>
                </SelectItem>
                <SelectItem value="CARD">
                  <span className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" /> {tx('chatInvoice_methodCard')}
                  </span>
                </SelectItem>
                <SelectItem value="MIR">
                  <span className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" /> {tx('chatInvoice_methodMir')}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{tx('chatInvoice_descriptionLabel')}</Label>
            <Input
              value={invoiceData.description}
              onChange={(e) => setInvoiceData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder={tx('chatInvoice_descriptionPlaceholder')}
            />
          </div>

          {booking?.id ? (
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
                  {tx('chatInvoice_extensionLabel')}
                </Label>
              </div>
              {invoiceData.extensionIntent && (
                <div className="space-y-1">
                  <Label htmlFor="invoice-new-checkout">{tx('chatInvoice_newCheckoutLabel')}</Label>
                  <Input
                    id="invoice-new-checkout"
                    type="datetime-local"
                    value={invoiceData.newCheckOut}
                    onChange={(e) =>
                      setInvoiceData((prev) => ({ ...prev, newCheckOut: e.target.value }))
                    }
                  />
                  <p className="text-xs text-slate-500">{tx('chatInvoice_extensionMetaHint')}</p>
                </div>
              )}
            </div>
          ) : null}

          <Button
            onClick={handleSend}
            disabled={sendDisabled}
            className="w-full bg-brand hover:bg-brand-hover"
            data-testid="chat-invoice-send-btn"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Receipt className="h-4 w-4 mr-2" />
            )}
            {tx('chatInvoice_sendButton')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default { InvoiceCard, SendInvoiceDialog }
