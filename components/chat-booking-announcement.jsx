'use client'

import { cn } from '@/lib/utils'
import { CalendarCheck, CalendarClock, CalendarX } from 'lucide-react'

/**
 * Карточка системного события по брони в ленте чата.
 */
export function ChatBookingAnnouncement({ message, language = 'ru' }) {
  const meta = message?.metadata || {}
  const sk = meta.system_key
  const isRu = language !== 'en'
  const accent =
    meta.announcement_accent ||
    (sk === 'booking_confirmed' ? 'success' : sk === 'booking_declined' ? 'danger' : 'info')

  const title =
    (isRu ? meta.announcement_title : meta.announcement_title_en || meta.announcement_title) ||
    (sk === 'booking_confirmed'
      ? isRu
        ? 'Бронирование подтверждено'
        : 'Booking confirmed'
      : sk === 'booking_declined'
        ? isRu
          ? 'Бронирование отклонено'
          : 'Booking declined'
        : isRu
          ? 'Обновление бронирования'
          : 'Booking update')
  const body =
    (isRu ? meta.announcement_body : meta.announcement_body_en || meta.announcement_body) ||
    (message?.message ?? message?.content ?? '')

  const confirmed = sk === 'booking_confirmed' || accent === 'success'
  const danger = sk === 'booking_declined' || accent === 'danger'

  return (
    <div
      className={cn(
        'mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'shrink-0 rounded-2xl bg-slate-50 p-2',
            confirmed
              ? 'text-teal-600'
              : danger
                ? 'text-slate-500'
                : 'text-slate-500'
          )}
        >
          {confirmed ? (
            <CalendarCheck className="h-5 w-5" />
          ) : danger ? (
            <CalendarX className="h-5 w-5" />
          ) : (
            <CalendarClock className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 text-left">
          <p className="font-semibold text-slate-900 text-sm">{title}</p>
          <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap break-words">{body}</p>
          <p className="text-[10px] text-slate-500 mt-2 uppercase tracking-wide">
            {isRu ? 'Системное уведомление' : 'System update'}
          </p>
        </div>
      </div>
    </div>
  )
}
