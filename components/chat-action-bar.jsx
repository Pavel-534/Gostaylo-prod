'use client'

/* eslint-disable unused-imports/no-unused-imports -- ESLint espree в этом репо не помечает использование в JSX как ref для импортов */
/**
 * ChatActionBar — контекстная панель действий над полем ввода.
 *
 * Тактильный отклик (мобилка): pointerdown → opacity + scale; `data-pressing` для Playwright.
 * См. `docs/TECHNICAL_MANIFESTO.md`.
 */

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Receipt, CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils'

const T = {
  confirm: { ru: '✅ Подтвердить', en: '✅ Confirm' },
  decline: { ru: '❌ Отклонить', en: '❌ Decline' },
  invoice: { ru: '📄 Счёт', en: '📄 Invoice' },
  pay: { ru: '💳 Оплатить', en: '💳 Pay now' },
  awaitPay: { ru: '⏳ Ожидаем оплату', en: '⏳ Awaiting payment' },
}
const t = (key, lang) => T[key]?.[lang === 'en' ? 'en' : 'ru'] ?? ''

const barShell =
  'shrink-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-5 shadow-[0_-4px_24px_-8px_rgba(15,23,42,0.06)]'

const tactile = 'transition-[opacity,transform] duration-100 ease-out active:opacity-70 active:scale-[0.98]'

/** Нет смысла показывать оплату / «ожидаем оплату» для финальных статусов */
const NO_PAY_TRAVEL_STATUSES = new Set([
  'CANCELLED',
  'REFUNDED',
  'COMPLETED',
  'PAID',
  'PAID_ESCROW',
])

export function ChatActionBar({
  isHosting = false,
  isTraveling = false,
  booking = null,
  payNowHref = null,
  /** Сразу скрыть панель гостя после нажатия «Оплатить» (оптимистичный UI). */
  suppressTravelPayBar = false,
  /** Вызывается перед переходом на checkout (клик по «Оплатить»). */
  onPayNowClick,
  onConfirm,
  onDecline,
  onOpenInvoice,
  /** Устарело для хоста: кнопки скрываются оптимистично по статусу брони; оставлено для совместимости. */
  loading = false,
  language = 'ru',
}) {
  const bookingStatus = String(booking?.status || '').toUpperCase()
  const [pressPay, setPressPay] = useState(false)
  const [pressDecline, setPressDecline] = useState(false)
  const [pressConfirm, setPressConfirm] = useState(false)
  const [pressInvoice, setPressInvoice] = useState(false)

  if (isTraveling && !isHosting) {
    if (suppressTravelPayBar) return null
    if (NO_PAY_TRAVEL_STATUSES.has(bookingStatus)) return null
    if (!payNowHref && bookingStatus !== 'CONFIRMED') return null

    return (
      <div className={`${barShell} flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4`}>
        <span className="text-sm font-semibold leading-snug text-slate-800 sm:min-w-0 sm:flex-1">
          {payNowHref ? t('pay', language) : t('awaitPay', language)}
        </span>
        {payNowHref && (
          <Button
            asChild
            className={cn(
              'h-12 min-h-[48px] w-full shrink-0 gap-2 rounded-2xl bg-teal-600 text-base font-bold text-white shadow-sm hover:bg-teal-700 sm:w-auto sm:min-w-[11rem]',
              tactile,
              pressPay && 'opacity-70 scale-[0.98]',
            )}
          >
            <Link
              href={payNowHref}
              data-testid="chat-action-pay"
              data-pressing={pressPay ? 'true' : 'false'}
              onClick={() => onPayNowClick?.()}
              onPointerDown={() => setPressPay(true)}
              onPointerUp={() => setPressPay(false)}
              onPointerCancel={() => setPressPay(false)}
              onPointerLeave={() => setPressPay(false)}
            >
              <CreditCard className="h-5 w-5" />
              {t('pay', language)}
            </Link>
          </Button>
        )}
      </div>
    )
  }

  if (isHosting) {
    if (bookingStatus === 'CANCELLED' || bookingStatus === 'REFUNDED') return null

    const hostAwaitingDecision = bookingStatus === 'PENDING' || bookingStatus === 'INQUIRY'

    if (hostAwaitingDecision && (onConfirm || onDecline)) {
      return (
        <div
          className={`${barShell} flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 lg:hidden`}
        >
          <span className="text-sm font-semibold leading-snug text-slate-800 sm:min-w-0 sm:flex-1">
            {language === 'en' ? 'New booking request' : 'Новый запрос на бронирование'}
          </span>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
            {onDecline && (
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={onDecline}
                data-testid="chat-action-decline"
                data-pressing={pressDecline ? 'true' : 'false'}
                onPointerDown={() => setPressDecline(true)}
                onPointerUp={() => setPressDecline(false)}
                onPointerCancel={() => setPressDecline(false)}
                onPointerLeave={() => setPressDecline(false)}
                className={cn(
                  'h-12 min-h-[48px] w-full gap-2 rounded-2xl border border-slate-200 bg-white text-base font-bold text-slate-700 hover:bg-slate-50 sm:w-auto sm:min-w-[10rem]',
                  tactile,
                  pressDecline && 'opacity-70 scale-[0.98]',
                )}
              >
                <XCircle className="h-5 w-5" />
                {t('decline', language)}
              </Button>
            )}
            {onConfirm && (
              <Button
                type="button"
                disabled={loading}
                onClick={onConfirm}
                data-testid="chat-action-confirm"
                data-pressing={pressConfirm ? 'true' : 'false'}
                onPointerDown={() => setPressConfirm(true)}
                onPointerUp={() => setPressConfirm(false)}
                onPointerCancel={() => setPressConfirm(false)}
                onPointerLeave={() => setPressConfirm(false)}
                className={cn(
                  'h-12 min-h-[48px] w-full gap-2 rounded-2xl bg-teal-600 text-base font-bold text-white shadow-sm hover:bg-teal-700 sm:w-auto sm:min-w-[10rem]',
                  tactile,
                  pressConfirm && 'opacity-70 scale-[0.98]',
                )}
              >
                <CheckCircle2 className="h-5 w-5" />
                {t('confirm', language)}
              </Button>
            )}
          </div>
        </div>
      )
    }

    if (bookingStatus === 'CONFIRMED' && typeof onOpenInvoice === 'function') {
      return (
        <div
          className={`${barShell} flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 lg:hidden`}
        >
          <span className="text-sm font-semibold leading-snug text-slate-800 sm:min-w-0 sm:flex-1">
            {language === 'en'
              ? 'Booking confirmed — ready to invoice'
              : 'Бронирование подтверждено — выставьте счёт'}
          </span>
          <Button
            type="button"
            variant="outline"
            data-testid="chat-action-invoice"
            data-pressing={pressInvoice ? 'true' : 'false'}
            onPointerDown={() => setPressInvoice(true)}
            onPointerUp={() => setPressInvoice(false)}
            onPointerCancel={() => setPressInvoice(false)}
            onPointerLeave={() => setPressInvoice(false)}
            className={cn(
              'h-12 min-h-[48px] w-full gap-2 rounded-2xl border border-slate-200 bg-white text-base font-bold text-slate-900 shadow-sm hover:bg-slate-50 sm:w-auto sm:min-w-[11rem]',
              tactile,
              pressInvoice && 'opacity-70 scale-[0.98]',
            )}
            onClick={onOpenInvoice}
          >
            <Receipt className="h-5 w-5" />
            {t('invoice', language)}
          </Button>
        </div>
      )
    }
  }

  return null
}
