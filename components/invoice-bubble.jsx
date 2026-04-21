'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { CreditCard, Wallet, Receipt, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const STATUS_LABEL = {
  PENDING: { en: 'Pending', ru: 'Ожидает оплаты' },
  PAID: { en: 'Paid', ru: 'Оплачен' },
  EXPIRED: { en: 'Expired', ru: 'Истёк' },
  CANCELLED: { en: 'Cancelled', ru: 'Отменён' },
}

/**
 * Компактная карточка счёта в ленте чата (in-app billing).
 */
export function InvoiceBubble({
  invoice,
  isOwn = false,
  /** Показать «Оплатить» (рентер) */
  showPay = false,
  paymentMethod = 'CRYPTO',
  className,
  /** id сообщения type=invoice — для отмены партнёром */
  messageId = null,
  onInvoiceCancelled = null,
  language = 'ru',
}) {
  const router = useRouter()
  const [methodOpen, setMethodOpen] = useState(false)
  const [navigating, setNavigating] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const isEn = language === 'en'

  if (!invoice) return null

  const rawStatus = String(invoice.status || 'PENDING').toUpperCase()
  const statusInfo = STATUS_LABEL[rawStatus] || STATUS_LABEL.PENDING
  const isPaid = rawStatus === 'PAID'
  const currency = String(invoice.currency || 'THB').toUpperCase()
  const sym = currency === 'THB' ? '฿' : currency === 'RUB' ? '₽' : '$'

  function goCheckout(pm) {
    const bid = invoice.booking_id
    if (!bid) {
      setMethodOpen(false)
      return
    }
    setNavigating(true)
    const qs = new URLSearchParams({ pm: String(pm || 'CARD') })
    if (invoice.id) qs.set('invoiceId', String(invoice.id))
    router.push(`/checkout/${encodeURIComponent(bid)}?${qs.toString()}`)
  }

  async function cancelInvoice() {
    if (!messageId) return
    setCancelling(true)
    try {
      const res = await fetch('/api/v2/chat/invoice/cancel', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error(json.error || (isEn ? 'Could not cancel invoice' : 'Не удалось отменить счёт'))
        return
      }
      toast.success(isEn ? 'Invoice cancelled' : 'Счёт отменён')
      onInvoiceCancelled?.()
    } catch {
      toast.error(isEn ? 'Network error' : 'Ошибка сети')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <>
      <div
        className={cn(
          'w-full max-w-full rounded-2xl border border-slate-200/90 p-4 shadow-[0_4px_20px_-6px_rgba(15,23,42,0.12),0_2px_8px_-3px_rgba(15,23,42,0.06)] sm:max-w-[320px]',
          isOwn
            ? 'ml-auto bg-white ring-1 ring-teal-200/60'
            : 'mr-auto bg-white',
          className
        )}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="rounded-xl bg-slate-50 p-2">
              <Receipt className="h-5 w-5 text-teal-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {isEn ? 'Invoice' : 'Счёт'}
              </p>
              <p className="truncate font-mono text-xs font-semibold text-slate-800">
                #{String(invoice.id || '').slice(-8)}
              </p>
            </div>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase',
              isPaid ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-950'
            )}
            title={statusInfo.ru}
          >
            {isEn ? statusInfo.en : statusInfo.ru}
          </span>
        </div>

        <div className="mb-3 rounded-xl bg-slate-50 px-3 py-3">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            {isEn ? 'Amount' : 'Сумма'}
          </p>
          <p className="text-2xl font-bold tabular-nums text-slate-900">
            {sym}
            {Number(invoice.amount ?? 0).toLocaleString()}{' '}
            <span className="text-base font-semibold text-slate-600">{currency}</span>
          </p>
        </div>

        {invoice.description && (
          <p className="mb-3 line-clamp-3 text-sm font-medium leading-snug text-slate-700">
            {invoice.description}
          </p>
        )}

        {showPay && !isOwn && rawStatus === 'PENDING' && (
          <Button
            type="button"
            className="h-12 min-h-[48px] w-full rounded-xl bg-teal-600 text-base font-bold text-white shadow-sm hover:bg-teal-700"
            data-testid="invoice-bubble-pay"
            onClick={() => {
              if (!invoice.booking_id) {
                toast.error('К счёту не привязано бронирование')
                return
              }
              setMethodOpen(true)
            }}
            disabled={navigating}
          >
            {navigating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>Оплатить</>
            )}
          </Button>
        )}

        {isOwn && rawStatus === 'PENDING' && (
          <div className="flex flex-col gap-2">
            <p className="text-center text-xs font-medium text-slate-600">
              {isEn ? 'Awaiting payment' : 'Ожидаем оплату'}
            </p>
            {messageId ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 min-h-[44px] w-full rounded-xl border-red-200 text-sm font-semibold text-red-700 hover:bg-red-50"
                disabled={cancelling}
                onClick={cancelInvoice}
              >
                {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : isEn ? 'Cancel invoice' : 'Отменить счёт'}
              </Button>
            ) : null}
          </div>
        )}
      </div>

      <Dialog open={methodOpen} onOpenChange={setMethodOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Способ оплаты</DialogTitle>
            <DialogDescription>
              Выберите, как удобнее оплатить счёт. Вы останетесь в потоке чата после перехода.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="justify-start gap-2 h-auto py-3"
              onClick={() => {
                setMethodOpen(false)
                goCheckout('CRYPTO')
              }}
            >
              <Wallet className="h-5 w-5 text-amber-600" />
              <span className="text-left">
                <span className="block font-medium">Криптовалюта</span>
                <span className="text-xs text-slate-500">USDT (TRC-20) и др.</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="justify-start gap-2 h-auto py-3"
              onClick={() => {
                setMethodOpen(false)
                goCheckout('CARD')
              }}
            >
              <CreditCard className="h-5 w-5 text-teal-600" />
              <span className="text-left">
                <span className="block font-medium">Банковская карта</span>
                <span className="text-xs text-slate-500">Visa, Mastercard, МИР</span>
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="justify-start gap-2 h-auto py-3"
              onClick={() => {
                setMethodOpen(false)
                goCheckout('MIR')
              }}
            >
              <CreditCard className="h-5 w-5 text-blue-600" />
              <span className="text-left">
                <span className="block font-medium">Карта МИР</span>
                <span className="text-xs text-slate-500">Банки РФ</span>
              </span>
            </Button>
          </div>
          {!invoice.booking_id && (
            <p className="text-xs text-amber-800 bg-amber-50 rounded-md p-2 mt-2">
              К счёту не привязано бронирование — оплата через кассу недоступна. Напишите партнёру.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
