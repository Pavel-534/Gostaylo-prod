'use client'

/**
 * ChatActionBar — контекстная панель действий над полем ввода.
 *
 * Отображается только тогда, когда есть что делать:
 *   • Для Гостя (isTraveling): кнопка [💳 Оплатить] когда есть инвойс PENDING.
 *   • Для Хозяина (isHosting) + бронирование PENDING: [✅ Подтвердить] [❌ Отклонить].
 *   • Для Хозяина (isHosting) + бронирование CONFIRMED: [📄 Выставить счёт] (открывает диалог).
 *
 * Props:
 *   isHosting       {boolean}
 *   isTraveling     {boolean}
 *   booking         {object|null}   — обогащённый объект брони из state
 *   payNowHref      {string|null}   — /checkout/bookingId?pm=… для кнопки оплаты
 *   onConfirm       {Function}      — хозяин подтверждает бронь
 *   onDecline       {Function}      — хозяин отклоняет бронь (открывает диалог)
 *   onOpenInvoice   {Function}      — хозяин открывает диалог счёта
 *   loading         {boolean}       — идёт запрос (disable кнопок)
 *   language        {'ru'|'en'}
 */

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Receipt, CreditCard, Loader2 } from 'lucide-react'

const T = {
  confirm:  { ru: '✅ Подтвердить', en: '✅ Confirm' },
  decline:  { ru: '❌ Отклонить',   en: '❌ Decline' },
  invoice:  { ru: '📄 Счёт',        en: '📄 Invoice' },
  pay:      { ru: '💳 Оплатить',    en: '💳 Pay now' },
  awaitPay: { ru: '⏳ Ожидаем оплату', en: '⏳ Awaiting payment' },
}
const t = (key, lang) => T[key]?.[lang === 'en' ? 'en' : 'ru'] ?? ''

export function ChatActionBar({
  isHosting = false,
  isTraveling = false,
  booking = null,
  payNowHref = null,
  onConfirm,
  onDecline,
  onOpenInvoice,
  loading = false,
  language = 'ru',
}) {
  const bookingStatus = String(booking?.status || '').toUpperCase()

  // ── Guest bar ────────────────────────────────────────────────────────────
  if (isTraveling && !isHosting) {
    // Only show when there's something actionable.
    if (!payNowHref && bookingStatus !== 'CONFIRMED') return null

    return (
      <div className="shrink-0 border-t border-teal-100 bg-teal-50 px-4 py-2 flex items-center gap-3">
        <span className="flex-1 text-sm text-teal-800 font-medium">
          {payNowHref
            ? t('pay', language)
            : t('awaitPay', language)}
        </span>
        {payNowHref && (
          <Button
            asChild
            size="sm"
            className="bg-teal-600 hover:bg-teal-700 text-white shrink-0 gap-1.5"
          >
            <Link href={payNowHref}>
              <CreditCard className="h-4 w-4" />
              {t('pay', language)}
            </Link>
          </Button>
        )}
      </div>
    )
  }

  // ── Host bar ─────────────────────────────────────────────────────────────
  if (isHosting) {
    // PENDING booking: confirm / decline
    if (bookingStatus === 'PENDING' && (onConfirm || onDecline)) {
      return (
        <div className="shrink-0 border-t border-amber-100 bg-amber-50 px-4 py-2 flex items-center gap-2 flex-wrap">
          <span className="flex-1 text-sm text-amber-800 font-medium min-w-0 truncate">
            {language === 'en' ? 'New booking request' : 'Новый запрос на бронирование'}
          </span>
          <div className="flex gap-2 shrink-0">
            {onDecline && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={onDecline}
                className="border-red-200 text-red-700 hover:bg-red-50 gap-1"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                {t('decline', language)}
              </Button>
            )}
            {onConfirm && (
              <Button
                type="button"
                size="sm"
                disabled={loading}
                onClick={onConfirm}
                className="bg-teal-600 hover:bg-teal-700 text-white gap-1"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {t('confirm', language)}
              </Button>
            )}
          </div>
        </div>
      )
    }

    // CONFIRMED booking: invoice button
    if (bookingStatus === 'CONFIRMED' && typeof onOpenInvoice === 'function') {
      return (
        <div className="shrink-0 border-t border-blue-100 bg-blue-50 px-4 py-2 flex items-center gap-3">
          <span className="flex-1 text-sm text-blue-800 font-medium">
            {language === 'en' ? 'Booking confirmed — ready to invoice' : 'Бронирование подтверждено — выставьте счёт'}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-blue-300 text-blue-800 hover:bg-blue-100 shrink-0 gap-1.5"
            onClick={onOpenInvoice}
          >
            <Receipt className="h-4 w-4" />
            {t('invoice', language)}
          </Button>
        </div>
      )
    }
  }

  return null
}
