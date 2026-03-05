/**
 * Gostaylo - In-Chat Invoice Component
 * Rich card for sending/receiving payment requests in chat
 */

'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Receipt, CreditCard, Wallet, Calendar, Home, 
  CheckCircle, Clock, XCircle, ExternalLink, Loader2,
  DollarSign, Bitcoin
} from 'lucide-react'
import { formatPrice } from '@/lib/currency'

// Currency configurations
const CURRENCY_CONFIG = {
  THB: { symbol: '฿', icon: DollarSign, color: 'text-green-600', bgColor: 'bg-green-50' },
  USDT: { symbol: '$', icon: Bitcoin, color: 'text-amber-600', bgColor: 'bg-amber-50' },
  RUB: { symbol: '₽', icon: DollarSign, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  USD: { symbol: '$', icon: DollarSign, color: 'text-emerald-600', bgColor: 'bg-emerald-50' }
}

// Payment method to currency mapping
const METHOD_CURRENCY = {
  CRYPTO: 'USDT',
  USDT_TRC20: 'USDT',
  CARD: 'THB',
  CARD_INTL: 'USD',
  MIR: 'RUB',
  THAI_QR: 'THB'
}

// Invoice status configurations
const STATUS_CONFIG = {
  PENDING: { label: 'Ожидает оплаты', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  PAID: { label: 'Оплачен', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  EXPIRED: { label: 'Истёк', color: 'bg-gray-100 text-gray-800', icon: XCircle },
  CANCELLED: { label: 'Отменён', color: 'bg-red-100 text-red-800', icon: XCircle }
}

/**
 * Invoice Card displayed in chat
 */
export function InvoiceCard({ 
  invoice, 
  isOwn = false, 
  onPay = null,
  paymentMethod = 'CRYPTO'
}) {
  const currency = METHOD_CURRENCY[paymentMethod] || 'THB'
  const currencyConfig = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.THB
  const statusConfig = STATUS_CONFIG[invoice?.status] || STATUS_CONFIG.PENDING
  const StatusIcon = statusConfig.icon
  const CurrencyIcon = currencyConfig.icon

  return (
    <Card className={`w-full max-w-sm ${isOwn ? 'ml-auto' : ''} border-2 border-teal-200 shadow-lg`}>
      <CardContent className="p-4">
        {/* Header */}
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

        {/* Listing Info */}
        {invoice?.listing && (
          <div className="flex items-center gap-2 mb-3 p-2 bg-slate-50 rounded-lg">
            <Home className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700 truncate">
              {invoice.listing.title || 'Объект'}
            </span>
          </div>
        )}

        {/* Dates */}
        {invoice?.check_in && invoice?.check_out && (
          <div className="flex items-center gap-2 mb-3 text-sm text-slate-600">
            <Calendar className="h-4 w-4" />
            <span>{invoice.check_in} — {invoice.check_out}</span>
          </div>
        )}

        {/* Amount */}
        <div className={`rounded-lg p-4 mb-3 ${currencyConfig.bgColor}`}>
          <p className="text-xs text-slate-600 mb-1">Сумма к оплате</p>
          <p className={`text-2xl font-bold ${currencyConfig.color}`}>
            {currencyConfig.symbol}{invoice?.amount?.toLocaleString() || 0}
            <span className="text-sm font-normal ml-1">{currency}</span>
          </p>
          {invoice?.amount_thb && currency !== 'THB' && (
            <p className="text-xs text-slate-500 mt-1">
              ≈ ฿{invoice.amount_thb.toLocaleString()} THB
            </p>
          )}
        </div>

        {/* Description */}
        {invoice?.description && (
          <p className="text-sm text-slate-600 mb-3 italic">
            "{invoice.description}"
          </p>
        )}

        {/* Pay Button */}
        {invoice?.status === 'PENDING' && onPay && !isOwn && (
          <Button 
            onClick={() => onPay(invoice)}
            className="w-full bg-teal-600 hover:bg-teal-700"
            data-testid="invoice-pay-btn"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Оплатить
          </Button>
        )}

        {/* View Details for own invoices */}
        {isOwn && invoice?.status === 'PENDING' && (
          <p className="text-xs text-center text-slate-500">
            Ожидаем оплату от гостя
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Send Invoice Dialog for Partners
 */
export function SendInvoiceDialog({ 
  booking = null, 
  listing = null,
  onSend,
  trigger 
}) {
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [invoiceData, setInvoiceData] = useState({
    amount: booking?.price_thb || '',
    currency: 'THB',
    description: '',
    paymentMethod: 'CRYPTO'
  })

  const handleSend = async () => {
    if (!invoiceData.amount) return

    setSending(true)
    try {
      await onSend({
        ...invoiceData,
        booking_id: booking?.id,
        listing_id: listing?.id,
        listing_title: listing?.title,
        check_in: booking?.check_in,
        check_out: booking?.check_out
      })
      setOpen(false)
      setInvoiceData({ amount: '', currency: 'THB', description: '', paymentMethod: 'CRYPTO' })
    } catch (error) {
      console.error('Send invoice error:', error)
    } finally {
      setSending(false)
    }
  }

  // Calculate USDT amount
  const usdtAmount = invoiceData.currency === 'THB' 
    ? Math.round((parseFloat(invoiceData.amount) || 0) / 35.5 * 100) / 100
    : invoiceData.amount

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1">
            <Receipt className="h-4 w-4" />
            Счёт
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-teal-600" />
            Создать счёт на оплату
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Listing Info */}
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

          {/* Amount */}
          <div>
            <Label>Сумма</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={invoiceData.amount}
                onChange={(e) => setInvoiceData(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0"
                className="flex-1"
              />
              <Select 
                value={invoiceData.currency}
                onValueChange={(v) => setInvoiceData(prev => ({ ...prev, currency: v }))}
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
            {invoiceData.currency === 'THB' && invoiceData.amount && (
              <p className="text-xs text-slate-500 mt-1">
                ≈ {usdtAmount} USDT
              </p>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <Label>Способ оплаты</Label>
            <Select 
              value={invoiceData.paymentMethod}
              onValueChange={(v) => setInvoiceData(prev => ({ ...prev, paymentMethod: v }))}
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

          {/* Description */}
          <div>
            <Label>Комментарий (опционально)</Label>
            <Input
              value={invoiceData.description}
              onChange={(e) => setInvoiceData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Оплата за проживание..."
            />
          </div>

          {/* Send Button */}
          <Button 
            onClick={handleSend}
            disabled={!invoiceData.amount || sending}
            className="w-full bg-teal-600 hover:bg-teal-700"
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
