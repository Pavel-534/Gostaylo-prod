'use client'

/**
 * Правая панель «сделка» (Airbnb-style): превью листинга, даты, сумма/статус, ссылка на объявление.
 */

import Link from 'next/link'
import { format } from 'date-fns'
import { ru as ruLocale } from 'date-fns/locale'
import { Building2, Calendar, CalendarRange, Banknote, ExternalLink } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toPublicImageUrl } from '@/lib/public-image-url'

function fmtDate(iso, language) {
  if (!iso) return null
  try {
    return format(new Date(iso), 'd MMM yyyy', { locale: language !== 'en' ? ruLocale : undefined })
  } catch {
    return null
  }
}

function statusLabel(status, language) {
  const s = String(status || '').toUpperCase()
  const mapRu = {
    PENDING: 'Ожидает решения',
    CONFIRMED: 'Подтверждено',
    PAID: 'Оплачено',
    COMPLETED: 'Завершено',
    CANCELLED: 'Отменено',
    CHECKED_IN: 'Заселение',
    CHECKED_OUT: 'Выезд',
  }
  const mapEn = {
    PENDING: 'Pending',
    CONFIRMED: 'Confirmed',
    PAID: 'Paid',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    CHECKED_IN: 'Checked in',
    CHECKED_OUT: 'Checked out',
  }
  const map = language === 'en' ? mapEn : mapRu
  return map[s] || status || '—'
}

/**
 * @param {Object} props
 * @param {Object|null} [props.listing]
 * @param {Object|null} [props.booking]
 * @param {string} [props.language]
 * @param {string} [props.className]
 * @param {Function} [props.onOpenCalendar] — открыть календарь занятости (партнёр / гость)
 */
export function DealDetailsCard({ listing = null, booking = null, language = 'ru', className, onOpenCalendar }) {
  const isEn = language === 'en'
  const imgRaw = listing?.images?.[0]
  const img = imgRaw ? toPublicImageUrl(imgRaw) || imgRaw : null
  const title = listing?.title || (isEn ? 'Listing' : 'Объект')

  const checkIn = booking?.check_in || booking?.checkIn
  const checkOut = booking?.check_out || booking?.checkOut
  const status = booking?.status

  const amount =
    booking?.total_price_thb ??
    booking?.totalPriceThb ??
    booking?.total_amount ??
    booking?.totalAmount ??
    listing?.base_price_thb ??
    null

  const amountLine =
    amount != null && amount !== ''
      ? `${Number(amount).toLocaleString()} THB`
      : isEn
        ? '—'
        : '—'

  return (
    <div className={cn('flex flex-col gap-4 p-4 lg:p-5', className)}>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
          {isEn ? 'Trip details' : 'Детали поездки'}
        </h3>

        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <div className="flex gap-3 p-3 bg-white">
            <div className="h-16 w-16 shrink-0 rounded-xl overflow-hidden bg-slate-100 border border-slate-100">
              {img ? (
                <img src={img} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <Building2 className="h-7 w-7 text-slate-300" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2">{title}</p>
              {listing?.district ? (
                <p className="text-xs text-slate-500 mt-0.5 truncate">{listing.district}</p>
              ) : null}
            </div>
          </div>
        </Card>
      </div>

      {booking?.id ? (
        <>
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <CalendarRange className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                  {isEn ? 'Check-in' : 'Заезд'}
                </p>
                <p className="text-slate-900 font-medium">{fmtDate(checkIn, language) || '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <CalendarRange className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                  {isEn ? 'Check-out' : 'Выезд'}
                </p>
                <p className="text-slate-900 font-medium">{fmtDate(checkOut, language) || '—'}</p>
              </div>
            </div>
          </div>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">{isEn ? 'Status' : 'Статус'}</span>
                <span className="text-xs font-semibold rounded-full bg-slate-100 text-slate-800 px-2 py-0.5">
                  {statusLabel(status, language)}
                </span>
              </div>
              <div className="flex items-start gap-2 pt-1 border-t border-slate-100">
                <Banknote className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] text-slate-500">{isEn ? 'Amount' : 'Сумма'}</p>
                  <p className="text-sm font-semibold text-slate-900">{amountLine}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="text-sm text-slate-500 leading-relaxed">
          {isEn
            ? 'No booking linked to this chat yet. Continue the conversation to request dates.'
            : 'К этому чату пока не привязано бронирование. Продолжите переписку, чтобы согласовать даты.'}
        </p>
      )}

      {typeof onOpenCalendar === 'function' ? (
        <Button
          type="button"
          variant="outline"
          className="w-full justify-center gap-2 border-teal-200 bg-teal-50/80 text-teal-900 hover:bg-teal-100 font-medium shadow-sm"
          onClick={onOpenCalendar}
        >
          <Calendar className="h-4 w-4 shrink-0" aria-hidden />
          {isEn ? 'Availability calendar' : 'Календарь занятости'}
        </Button>
      ) : null}

      {listing?.id ? (
        <Button
          asChild
          variant="outline"
          className="w-full justify-center gap-2 border-slate-200 text-slate-800 hover:bg-slate-50"
        >
          <Link href={`/listings/${listing.id}`}>
            <ExternalLink className="h-4 w-4 shrink-0" />
            {isEn ? 'View listing' : 'Перейти к объявлению'}
          </Link>
        </Button>
      ) : null}
    </div>
  )
}
