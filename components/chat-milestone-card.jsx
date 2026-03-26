'use client'

/**
 * ChatMilestoneCard — стильная карточка-веха для системных сообщений в ленте чата.
 *
 * Отображается по центру ленты вместо обычного пузыря.
 * Поддерживаемые system_key:
 *   booking_announcement, booking_confirmed, booking_declined, booking_cancelled,
 *   booking_status_update, booking_paid, paid, check_in, check_out,
 *   booking_pending, passport_request, refund, completed
 */

import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  CheckCircle2,
  XCircle,
  CreditCard,
  Key,
  Star,
  Clock,
  Bell,
  FileText,
  RotateCcw,
  Home,
  CalendarCheck,
} from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

// ─── Конфигурация визуала по статусу ─────────────────────────────────────────

const MILESTONE_CFG = {
  booking_confirmed: {
    icon: CheckCircle2,
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    iconColor: 'text-emerald-600',
    textColor: 'text-emerald-900',
    label: { ru: 'Бронирование подтверждено', en: 'Booking confirmed' },
  },
  booking_pending: {
    icon: Clock,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    iconColor: 'text-amber-600',
    textColor: 'text-amber-900',
    label: { ru: 'Ожидает подтверждения', en: 'Awaiting confirmation' },
  },
  booking_declined: {
    icon: XCircle,
    bg: 'bg-red-50',
    border: 'border-red-200',
    iconColor: 'text-red-500',
    textColor: 'text-red-900',
    label: { ru: 'Бронирование отклонено', en: 'Booking declined' },
  },
  booking_cancelled: {
    icon: XCircle,
    bg: 'bg-red-50',
    border: 'border-red-200',
    iconColor: 'text-red-500',
    textColor: 'text-red-900',
    label: { ru: 'Бронирование отменено', en: 'Booking cancelled' },
  },
  booking_paid: {
    icon: CreditCard,
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    iconColor: 'text-blue-600',
    textColor: 'text-blue-900',
    label: { ru: 'Оплата получена', en: 'Payment received' },
  },
  paid: {
    icon: CreditCard,
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    iconColor: 'text-blue-600',
    textColor: 'text-blue-900',
    label: { ru: 'Оплата получена', en: 'Payment received' },
  },
  check_in: {
    icon: Key,
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    iconColor: 'text-teal-600',
    textColor: 'text-teal-900',
    label: { ru: 'Заезд', en: 'Check-in' },
  },
  check_in_today: {
    icon: Key,
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    iconColor: 'text-teal-600',
    textColor: 'text-teal-900',
    label: { ru: 'Заезд сегодня', en: 'Check-in today' },
  },
  check_out: {
    icon: Home,
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    iconColor: 'text-indigo-600',
    textColor: 'text-indigo-900',
    label: { ru: 'Выезд', en: 'Check-out' },
  },
  check_out_today: {
    icon: Home,
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    iconColor: 'text-indigo-600',
    textColor: 'text-indigo-900',
    label: { ru: 'Выезд сегодня', en: 'Check-out today' },
  },
  completed: {
    icon: Star,
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    iconColor: 'text-yellow-600',
    textColor: 'text-yellow-900',
    label: { ru: 'Поездка завершена', en: 'Trip completed' },
  },
  refund: {
    icon: RotateCcw,
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    iconColor: 'text-slate-600',
    textColor: 'text-slate-800',
    label: { ru: 'Возврат средств', en: 'Refund issued' },
  },
  passport_request: {
    icon: FileText,
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    iconColor: 'text-teal-600',
    textColor: 'text-teal-900',
    label: { ru: 'Запрос документов', en: 'Document request' },
  },
  booking_announcement: {
    icon: CalendarCheck,
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    iconColor: 'text-emerald-600',
    textColor: 'text-emerald-900',
    label: { ru: 'Новое бронирование', en: 'New booking' },
  },
  booking_status_update: {
    icon: Bell,
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    iconColor: 'text-slate-500',
    textColor: 'text-slate-700',
    label: { ru: 'Статус обновлён', en: 'Status updated' },
  },
  _default: {
    icon: Bell,
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    iconColor: 'text-slate-500',
    textColor: 'text-slate-700',
    label: { ru: 'Системное уведомление', en: 'System notification' },
  },
}

function getConfig(systemKey, meta, lang) {
  // booking_announcement доминирует
  if (meta?.booking_announcement) return MILESTONE_CFG.booking_announcement
  const key = systemKey || '_default'
  return MILESTONE_CFG[key] || MILESTONE_CFG._default
}

// ─── Компонент ────────────────────────────────────────────────────────────────

/**
 * @param {object} message — объект сообщения из ленты
 * @param {string} language — 'ru' | 'en'
 * @param {string} [userRole] — 'renter' | 'partner' — для CTA кнопки отзыва
 */
export function ChatMilestoneCard({ message, language = 'ru', userRole }) {
  const meta = message.metadata || {}
  const sk = meta.system_key
  const cfg = getConfig(sk, meta, language)
  const Icon = cfg.icon
  const lang = language === 'en' ? 'en' : 'ru'

  // Текст — берём из meta.text / meta.message / message.content / message.message
  const bodyText =
    meta.text ||
    meta.message ||
    message.content ||
    message.message ||
    null

  // Специфические данные о бронировании
  const bookingDates = meta.check_in && meta.check_out
    ? `${meta.check_in} — ${meta.check_out}`
    : null
  const price = meta.price_thb
    ? `${Number(meta.price_thb).toLocaleString()} THB`
    : null

  // Время события
  const ts = message.created_at || message.createdAt
  let timeLabel = null
  if (ts) {
    try {
      timeLabel = format(new Date(ts), lang === 'ru' ? 'd MMM, HH:mm' : 'MMM d, HH:mm', {
        locale: lang === 'ru' ? ru : undefined,
      })
    } catch {}
  }

  // Review CTA: только для рентера при COMPLETED бронировании
  const toStatus = meta.booking_status_event?.to_status
  const isCompleted = sk === 'completed' || sk === 'booking_completed' || toStatus === 'COMPLETED'
  const bookingId = meta.booking_status_event?.booking_id || meta.booking_id
  const showReviewCta = isCompleted && (userRole === 'renter' || !userRole) && bookingId
  const reviewHref = showReviewCta
    ? `/renter/reviews/new?bookingId=${encodeURIComponent(bookingId)}`
    : null

  return (
    <div className="flex justify-center w-full px-4 my-1">
      <div
        className={cn(
          'inline-flex flex-col gap-2 rounded-xl border px-4 py-2.5 max-w-sm w-full text-left shadow-sm',
          cfg.bg,
          cfg.border,
        )}
      >
        <div className="flex items-start gap-2.5">
          <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', cfg.iconColor)} />
          <div className="min-w-0 flex-1">
            <p className={cn('text-xs font-semibold leading-tight', cfg.textColor)}>
              {cfg.label[lang]}
            </p>
            {bodyText && (
              <p className={cn('text-xs mt-0.5 leading-snug opacity-80', cfg.textColor)}>
                {bodyText}
              </p>
            )}
            {(bookingDates || price) && (
              <p className={cn('text-xs mt-0.5 opacity-70', cfg.textColor)}>
                {[bookingDates, price].filter(Boolean).join(' · ')}
              </p>
            )}
            {timeLabel && (
              <p className="text-[10px] text-slate-400 mt-1">{timeLabel}</p>
            )}
          </div>
        </div>

        {/* Review CTA для рентера после завершения поездки */}
        {showReviewCta && (
          <div className="border-t border-yellow-200 pt-2 mt-0.5">
            <p className="text-xs text-yellow-800 mb-1.5">
              {lang === 'ru' ? 'Как прошёл ваш отдых? Поделитесь впечатлениями!' : 'How was your stay? Share your experience!'}
            </p>
            <Link
              href={reviewHref}
              className="inline-flex items-center gap-1.5 rounded-lg bg-yellow-500 hover:bg-yellow-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
            >
              <Star className="h-3.5 w-3.5 fill-white" />
              {lang === 'ru' ? 'Оценить отдых' : 'Rate your stay'}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
