'use client'

import { useState, useEffect, useMemo } from 'react'
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
import { useCurrency } from '@/contexts/currency-context'
import { fetchExchangeRates } from '@/lib/client-data'
import { getInvoiceGuestAmountPresentation } from '@/lib/pricing/fx-display-client'
import { cancelChatInvoice } from '@/lib/chat/post-chat-invoice'
import { getUIText } from '@/lib/translations'
import { resolveInvoiceStatusPresentation } from '@/components/chat-invoice'
import { isBookingPaid } from '@/lib/mask-contacts'

const PAID_BOOKING_STATUSES = new Set([
  'PAID',
  'PAID_ESCROW',
  'CHECKED_IN',
  'THAWED',
  'THAW_HOLD',
  'READY_FOR_PAYOUT',
  'COMPLETED',
])

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
  /** Оптимистичный PAID в ленте до reload */
  onInvoicePaid = null,
  /** Статус брони — self-heal: PAID_ESCROW → пузырь «Оплачен» */
  bookingStatus = null,
  language = 'ru',
}) {
  const router = useRouter()
  const { currency: guestUiCurrency } = useCurrency()
  const [methodOpen, setMethodOpen] = useState(false)
  const [navigating, setNavigating] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [rateMap, setRateMap] = useState({ THB: 1 })
  const tx = (key, extras) => getUIText(key, language, extras)

  useEffect(() => {
    fetchExchangeRates({ retail: true }).then((m) => {
      if (m && typeof m === 'object') setRateMap(m)
    })
  }, [])

  const presentation = useMemo(
    () =>
      invoice
        ? getInvoiceGuestAmountPresentation({
            invoice,
            guestUiCurrency,
            rateMap,
            language,
          })
        : null,
    [invoice, guestUiCurrency, rateMap, language],
  )

  if (!invoice) return null

  const bookingPaid = PAID_BOOKING_STATUSES.has(String(bookingStatus || '').toUpperCase())
  const rawStatus = bookingPaid
    ? 'PAID'
    : String(invoice.status || 'PENDING').toUpperCase()
  const statusInfo = resolveInvoiceStatusPresentation(rawStatus, language)
  const isPaid = rawStatus === 'PAID'
  const canPay =
    showPay &&
    !isOwn &&
    !isPaid &&
    Boolean(invoice.booking_id) &&
    !bookingPaid

  function goCheckout(pm) {
    const bid = invoice.booking_id
    if (!bid) {
      setMethodOpen(false)
      toast.error(getUIText('invoiceBubble_noBookingLinked', language))
      return
    }
    onInvoicePaid?.()
    setNavigating(true)
    const qs = new URLSearchParams({ pm: String(pm || 'CARD') })
    if (invoice.id) qs.set('invoiceId', String(invoice.id))
    router.push(`/checkout/${encodeURIComponent(bid)}?${qs.toString()}`)
  }

  async function cancelInvoice() {
    if (!messageId) return
    setCancelling(true)
    try {
      const { ok, error } = await cancelChatInvoice(messageId)
      if (!ok) {
        toast.error(error || tx('invoiceBubble_cancelFailed'))
        return
      }
      toast.success(tx('invoiceBubble_cancelSuccess'))
      onInvoiceCancelled?.()
    } catch {
      toast.error(tx('listingDetail_networkError'))
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
            ? 'ml-auto bg-white ring-1 ring-brand/20'
            : 'mr-auto bg-white',
          className
        )}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="rounded-xl bg-slate-50 p-2">
              <Receipt className="h-5 w-5 text-brand" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {tx('invoiceBubble_title')}
              </p>
              <p className="truncate font-mono text-xs font-semibold text-slate-800">
                #{String(invoice.id || messageId || '').slice(-8)}
              </p>
            </div>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase',
              isPaid ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-950'
            )}
            title={statusInfo.label}
          >
            {statusInfo.label}
          </span>
        </div>

        <div className="mb-3 rounded-xl bg-slate-50 px-3 py-3">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            {tx('invoiceBubble_amountLabel')}
          </p>
          <p className="text-2xl font-bold tabular-nums text-slate-900">
            {presentation?.primary?.label ?? `${Number(invoice.amount ?? 0).toLocaleString()}`}
          </p>
          {presentation?.secondary && (
            <p className="mt-1 text-sm font-medium tabular-nums text-slate-600">
              {presentation.secondary.label}
            </p>
          )}
        </div>

        {invoice.description && (
          <p className="mb-3 line-clamp-3 text-sm font-medium leading-snug text-slate-700">
            {invoice.description}
          </p>
        )}

        {canPay && (
          <Button
            type="button"
            className="h-12 min-h-[48px] w-full rounded-xl bg-brand text-base font-bold text-white shadow-sm hover:bg-brand-hover"
            data-testid="invoice-bubble-pay"
            onClick={() => {
              if (!invoice.booking_id) {
                toast.error(getUIText('invoiceBubble_noBookingLinked', language))
                return
              }
              setMethodOpen(true)
            }}
            disabled={navigating}
          >
            {navigating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>{tx('invoiceBubble_payButton')}</>
            )}
          </Button>
        )}

        {showPay && !isOwn && !isPaid && !invoice.booking_id && !bookingPaid ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {getUIText('invoiceBubble_noBookingLinked', language)}
          </p>
        ) : null}

        {isOwn && rawStatus === 'PENDING' && !bookingPaid ? (
          <div className="flex flex-col gap-2">
            <p className="text-center text-xs font-medium text-slate-600">
              {tx('invoiceBubble_awaitingPayment')}
            </p>
            {messageId ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 min-h-[44px] w-full rounded-xl border-red-200 text-sm font-semibold text-red-700 hover:bg-red-50"
                disabled={cancelling}
                onClick={cancelInvoice}
              >
                {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : tx('invoiceBubble_cancelButton')}
              </Button>
            ) : null}
          </div>
        ) : null}

        {isPaid && bookingPaid && isBookingPaid(bookingStatus) ? (
          <p className="text-center text-xs font-medium text-emerald-800">
            {getUIText('invoiceBubble_paidEscrowHint', language)}
          </p>
        ) : null}
      </div>

      <Dialog open={methodOpen} onOpenChange={setMethodOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{tx('invoiceBubble_paymentMethodTitle')}</DialogTitle>
            <DialogDescription>{tx('invoiceBubble_paymentMethodDescription')}</DialogDescription>
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
                <span className="block font-medium">{tx('invoiceBubble_payCrypto')}</span>
                <span className="text-xs text-slate-500">{tx('invoiceBubble_payCryptoHint')}</span>
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
              <CreditCard className="h-5 w-5 text-brand" />
              <span className="text-left">
                <span className="block font-medium">{tx('invoiceBubble_payCard')}</span>
                <span className="text-xs text-slate-500">{tx('invoiceBubble_payCardHint')}</span>
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
                <span className="block font-medium">{tx('invoiceBubble_payMir')}</span>
                <span className="text-xs text-slate-500">{tx('invoiceBubble_payMirHint')}</span>
              </span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
