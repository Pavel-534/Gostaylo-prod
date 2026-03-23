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
}) {
  const router = useRouter()
  const [methodOpen, setMethodOpen] = useState(false)
  const [navigating, setNavigating] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  if (!invoice) return null

  const rawStatus = String(invoice.status || 'PENDING').toUpperCase()
  const statusInfo = STATUS_LABEL[rawStatus] || STATUS_LABEL.PENDING
  const isPaid = rawStatus === 'PAID'
  const currency = invoice.currency || (paymentMethod === 'CARD' ? 'THB' : 'THB')
  const sym = currency === 'THB' ? '฿' : '$'

  function goCheckout(pm) {
    const bid = invoice.booking_id
    if (!bid) {
      setMethodOpen(false)
      return
    }
    setNavigating(true)
    router.push(`/checkout/${encodeURIComponent(bid)}?pm=${pm}`)
  }

  return (
    <>
      <div
        className={cn(
          'max-w-[280px] rounded-2xl border-2 p-3 shadow-sm',
          isOwn
            ? 'border-teal-300 bg-teal-50/80 ml-auto'
            : 'border-amber-200 bg-amber-50/90 mr-auto',
          className
        )}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="rounded-lg bg-white p-1.5 border border-slate-200">
              <Receipt className="h-4 w-4 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Invoice</p>
              <p className="text-xs font-mono text-slate-700 truncate">
                #{String(invoice.id || '').slice(-8)}
              </p>
            </div>
          </div>
          <span
            className={cn(
              'text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full shrink-0',
              isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
            )}
            title={statusInfo.ru}
          >
            {statusInfo.en}
          </span>
        </div>

        <div className="rounded-xl bg-white/80 px-3 py-2 mb-2 border border-slate-100">
          <p className="text-[10px] text-slate-500 mb-0.5">Amount</p>
          <p className="text-xl font-bold text-slate-900">
            {sym}
            {Number(invoice.amount ?? 0).toLocaleString()}{' '}
            <span className="text-sm font-normal text-slate-600">{currency}</span>
          </p>
        </div>

        {invoice.description && (
          <p className="text-xs text-slate-600 mb-2 line-clamp-2">{invoice.description}</p>
        )}

        {showPay && !isOwn && rawStatus === 'PENDING' && (
          <Button
            type="button"
            size="sm"
            className="w-full bg-teal-600 hover:bg-teal-700 h-9"
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
            <p className="text-[10px] text-center text-slate-500">Ожидаем оплату</p>
            {messageId ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs border-red-200 text-red-700 hover:bg-red-50"
                disabled={cancelling}
                onClick={cancelInvoice}
              >
                {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Cancel Invoice'}
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
