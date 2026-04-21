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
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getUIText } from '@/lib/translations'
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
    bg: 'bg-white',
    border: 'border-slate-200',
    iconColor: 'text-teal-600',
    textColor: 'text-slate-700',
    label: { ru: 'Бронирование подтверждено', en: 'Booking confirmed' },
  },
  booking_pending: {
    icon: Clock,
    bg: 'bg-white',
    border: 'border-slate-200',
    iconColor: 'text-slate-500',
    textColor: 'text-slate-700',
    label: { ru: 'Ожидает подтверждения', en: 'Awaiting confirmation' },
  },
  booking_declined: {
    icon: XCircle,
    bg: 'bg-white',
    border: 'border-slate-200',
    iconColor: 'text-slate-500',
    textColor: 'text-slate-700',
    label: { ru: 'Бронирование отклонено', en: 'Booking declined' },
  },
  booking_cancelled: {
    icon: XCircle,
    bg: 'bg-white',
    border: 'border-slate-200',
    iconColor: 'text-slate-500',
    textColor: 'text-slate-700',
    label: { ru: 'Бронирование отменено', en: 'Booking cancelled' },
  },
  booking_paid: {
    icon: CreditCard,
    bg: 'bg-white',
    border: 'border-slate-200',
    iconColor: 'text-teal-600',
    textColor: 'text-slate-700',
    label: { ru: 'Оплата получена', en: 'Payment received' },
  },
  paid: {
    icon: CreditCard,
    bg: 'bg-white',
    border: 'border-slate-200',
    iconColor: 'text-teal-600',
    textColor: 'text-slate-700',
    label: { ru: 'Оплата получена', en: 'Payment received' },
  },
  check_in: {
    icon: Key,
    bg: 'bg-white',
    border: 'border-slate-200',
    iconColor: 'text-teal-600',
    textColor: 'text-slate-700',
    label: { ru: 'Заезд', en: 'Check-in' },
  },
  check_in_today: {
    icon: Key,
    bg: 'bg-white',
    border: 'border-slate-200',
    iconColor: 'text-teal-600',
    textColor: 'text-slate-700',
    label: { ru: 'Заезд сегодня', en: 'Check-in today' },
  },
  check_out: {
    icon: Home,
    bg: 'bg-white',
    border: 'border-slate-200',
    iconColor: 'text-slate-500',
    textColor: 'text-slate-700',
    label: { ru: 'Выезд', en: 'Check-out' },
  },
  check_out_today: {
    icon: Home,
    bg: 'bg-white',
    border: 'border-slate-200',
    iconColor: 'text-slate-500',
    textColor: 'text-slate-700',
    label: { ru: 'Выезд сегодня', en: 'Check-out today' },
  },
  completed: {
    icon: Star,
    bg: 'bg-white',
    border: 'border-slate-200',
    iconColor: 'text-teal-600',
    textColor: 'text-slate-700',
    label: { ru: 'Поездка завершена', en: 'Trip completed' },
  },
  refund: {
    icon: RotateCcw,
    bg: 'bg-white',
    border: 'border-slate-200',
    iconColor: 'text-slate-600',
    textColor: 'text-slate-800',
    label: { ru: 'Возврат средств', en: 'Refund issued' },
  },
  passport_request: {
    icon: FileText,
    bg: 'bg-white',
    border: 'border-slate-200',
    iconColor: 'text-teal-600',
    textColor: 'text-slate-700',
    label: { ru: 'Запрос документов', en: 'Document request' },
  },
  booking_announcement: {
    icon: CalendarCheck,
    bg: 'bg-white',
    border: 'border-slate-200',
    iconColor: 'text-teal-600',
    textColor: 'text-slate-700',
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
  capacity_price_inquiry: {
    icon: Bell,
    bg: 'bg-white',
    border: 'border-slate-200',
    iconColor: 'text-teal-600',
    textColor: 'text-slate-700',
    label: { ru: 'Запрос цены и вместимости', en: 'Price & capacity inquiry' },
  },
  private_special_deal_inquiry: {
    icon: Bell,
    bg: 'bg-white',
    border: 'border-slate-200',
    iconColor: 'text-teal-600',
    textColor: 'text-slate-700',
    label: { ru: 'Индивидуальное предложение', en: 'Private / special deal request' },
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
 * @param {{ onConfirm?: () => void, onDecline?: () => void, loading?: boolean } | null} [partnerInquiryActions] — мобилка: подтвердить/отклонить под inquiry
 */
export function ChatMilestoneCard({ message, language = 'ru', userRole, partnerInquiryActions = null }) {
  const meta = message.metadata || {}
  const sk = meta.system_key
  const cfg = getConfig(sk, meta, language)
  const Icon = cfg.icon
  const lang = language === 'en' ? 'en' : 'ru'

  const isInquirySystem =
    sk === 'capacity_price_inquiry' || sk === 'private_special_deal_inquiry'

  /** Карточка «новое бронирование» (PENDING) — те же действия, что и для inquiry */
  const showMilestoneHostDecision =
    isInquirySystem || sk === 'booking_created'

  // Текст — для inquiry: локализованные поля из metadata; иначе meta.text / content
  const bodyText = isInquirySystem
    ? (lang === 'en' ? meta.inquiry_body_en : meta.inquiry_body_ru) ||
      meta.text ||
      meta.message ||
      message.content ||
      message.message ||
      null
    : meta.text ||
      meta.message ||
      message.content ||
      message.message ||
      null

  // Специфические данные о бронировании
  const listingTitle = meta.listing_title ? String(meta.listing_title) : null

  const bookingDates =
    !isInquirySystem && meta.check_in && meta.check_out
      ? `${meta.check_in} — ${meta.check_out}`
      : null
  const price =
    !isInquirySystem && meta.price_thb
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
    <div
      className="flex justify-center w-full px-4 my-2 sm:px-5 sm:my-2.5"
      data-testid="chat-milestone-wrap"
    >
      <div
        data-testid="chat-milestone-card"
        data-system-key={sk || ''}
        className={cn(
          'inline-flex w-full max-w-sm flex-col gap-3 rounded-2xl border px-4 py-4 text-left',
          'shadow-[0_4px_24px_-6px_rgba(15,23,42,0.12),0_2px_10px_-4px_rgba(15,23,42,0.07)]',
          cfg.border,
          cfg.bg,
        )}
      >
        <div className="flex items-start gap-3">
          <Icon className={cn('h-5 w-5 mt-0.5 shrink-0', cfg.iconColor)} />
          <div className="min-w-0 flex-1 space-y-1.5">
            {listingTitle ? (
              <p className="text-base font-bold leading-snug tracking-tight text-slate-900">
                {listingTitle}
              </p>
            ) : null}
            <p className={cn('text-[11px] font-bold uppercase tracking-wide', cfg.textColor)}>
              {cfg.label[lang]}
            </p>
            {bodyText && (
              <p className="text-sm leading-snug text-slate-700 whitespace-pre-wrap">{bodyText}</p>
            )}
            {(bookingDates || price) && (
              <div className="space-y-1 border-t border-slate-200/60 pt-2.5">
                {bookingDates ? (
                  <p className="text-sm font-semibold text-slate-800">{bookingDates}</p>
                ) : null}
                {price ? (
                  <p className="text-lg font-bold tabular-nums text-slate-900">{price}</p>
                ) : null}
              </div>
            )}
            {timeLabel && (
              <p className="text-[11px] text-slate-500">{timeLabel}</p>
            )}
          </div>
        </div>

        {showMilestoneHostDecision &&
        userRole === 'partner' &&
        partnerInquiryActions?.onConfirm &&
        partnerInquiryActions?.onDecline && (
          <div className="flex gap-2 border-t border-slate-200 pt-3 lg:hidden">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={partnerInquiryActions.loading}
              className="h-9 min-h-0 flex-1 rounded-xl border-slate-200 text-xs font-semibold"
              onClick={partnerInquiryActions.onDecline}
            >
              {getUIText('chatHeader_declineBooking', language)}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={partnerInquiryActions.loading}
              className="h-9 min-h-0 flex-1 rounded-xl bg-teal-600 text-xs font-semibold text-white hover:bg-teal-700"
              onClick={partnerInquiryActions.onConfirm}
            >
              {getUIText('chatHeader_confirmBooking', language)}
            </Button>
          </div>
        )}

        {showReviewCta && (
          <div className="border-t border-slate-200 pt-3">
            <p className="mb-3 text-sm font-medium text-slate-800">
              {lang === 'ru'
                ? 'Как прошёл ваш отдых? Поделитесь впечатлениями!'
                : 'How was your stay? Share your experience!'}
            </p>
            <Link
              href={reviewHref}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-teal-700"
            >
              <Star className="h-4 w-4 shrink-0 fill-white" />
              {lang === 'ru' ? 'Оценить отдых' : 'Rate your stay'}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
