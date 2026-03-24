'use client'

import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import Link from 'next/link'
import { Building2, Check, CreditCard, LifeBuoy, Loader2, Shield, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { BookingChatTimeline } from '@/components/booking-chat-timeline'

/**
 * Липкий контекст чата: фото листинга, название, даты и статус брони.
 * Для админа/модератора — полоса «Admin View».
 */
export function StickyChatHeader({
  listing,
  booking,
  isAdminView = false,
  /** Имя собеседника (клиент / партнёр) */
  contactName,
  /** null — не показывать индикатор; иначе зелёный/серый = online/offline */
  presenceOnline = null,
  /** Эскалация в поддержку (рентер / партнёр, не admin view) */
  onSupportClick = null,
  supportLoading = false,
  supportPriorityActive = false,
  /** Админка: подпись участников диалога под баннером Admin View */
  adminParticipants = null,
  supportLabel = 'Помощь',
  /** Показать рядом с кнопкой, если диалог уже в приоритете */
  supportDoneLabel = 'В очереди у поддержки',
  /** Только партнёр: PENDING-бронь — подтвердить / отклонить */
  partnerBookingActions = null,
  /** Текст «печатает…» (связка с useChatTyping; при typingGateWithPresence показываем только если собеседник online по usePresence) */
  typingIndicator = null,
  typingGateWithPresence = true,
  /** ru | en — подписи таймлайна брони */
  language = 'ru',
  /** Показывать полосу прогресса брони (если есть booking) */
  showBookingTimeline = true,
  /** Рентер: ссылка на единый checkout (при CONFIRMED + неоплаченный счёт) */
  payNowHref = null,
  className,
  children,
}) {
  const img = listing?.images?.[0]
  const title = listing?.title || '—'

  const from = booking?.check_in
  const to = booking?.check_out
  const status = booking?.status

  let dateLine = null
  if (from || to || status) {
    const a = from ? safeFormat(from) : null
    const b = to ? safeFormat(to) : null
    dateLine = (
      <p className="text-sm text-slate-600 flex flex-wrap items-center gap-x-1 gap-y-1">
        {a}
        {a && b ? ' — ' : null}
        {b}
        {status ? (
          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800">
            {status}
          </span>
        ) : null}
      </p>
    )
  }

  return (
    <div className={cn('sticky top-0 z-20 bg-white/95 backdrop-blur border-b shadow-sm', className)}>
      {isAdminView && (
        <div className="bg-amber-50 border-b border-amber-200/80 px-4 py-2 text-center text-xs font-medium text-amber-950 flex items-center justify-center gap-2">
          <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>Admin View — доступ супервизора ко всем сообщениям в этом диалоге</span>
        </div>
      )}
      {isAdminView && adminParticipants ? (
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200/80 text-xs text-slate-700 leading-relaxed">
          <p className="font-semibold text-slate-800 mb-1">Участники диалога</p>
          <ul className="list-disc list-inside space-y-0.5">
            {adminParticipants.renterName ? (
              <li>
                Гость: <span className="font-medium">{adminParticipants.renterName}</span>
              </li>
            ) : null}
            {adminParticipants.partnerName ? (
              <li>
                Партнёр: <span className="font-medium">{adminParticipants.partnerName}</span>
              </li>
            ) : null}
            {adminParticipants.bookingId ? (
              <li>
                Бронь:{' '}
                <span className="font-mono text-[11px]">{adminParticipants.bookingId}</span>
              </li>
            ) : null}
            {!adminParticipants.renterName && !adminParticipants.partnerName ? (
              <li className="text-slate-500">Участники не указаны в карточке беседы</li>
            ) : null}
          </ul>
        </div>
      ) : null}
      <div className="px-4 py-3 flex gap-3 items-start">
        {img ? (
          <img src={img} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0 border border-slate-100" />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
            <Building2 className="h-7 w-7 text-slate-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 truncate">{title}</p>
          {listing?.district ? (
            <p className="text-xs text-slate-500 truncate">{listing.district}</p>
          ) : null}
          {contactName ? (
            <p className="text-sm font-medium text-slate-800 mt-0.5 flex items-center gap-2">
              {contactName}
              {presenceOnline !== null && (
                <span
                  className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                    presenceOnline ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                  title={presenceOnline ? 'Online' : 'Offline'}
                  aria-hidden
                />
              )}
            </p>
          ) : null}
          {typingIndicator &&
          (!typingGateWithPresence || presenceOnline !== false) ? (
            <p className="text-xs text-teal-600 mt-1 truncate animate-pulse" aria-live="polite">
              {typingIndicator}
            </p>
          ) : null}
          {dateLine}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-2">
          {!isAdminView && partnerBookingActions?.visible ? (
            <div className="flex flex-wrap justify-end gap-1.5">
              <Button
                type="button"
                size="sm"
                className="h-8 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={partnerBookingActions.loading}
                onClick={partnerBookingActions.onConfirm}
              >
                {partnerBookingActions.loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Confirm Booking
                  </>
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="h-8 px-2.5 text-xs"
                disabled={partnerBookingActions.loading}
                onClick={partnerBookingActions.onDecline}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Decline
              </Button>
            </div>
          ) : null}
          {!isAdminView && payNowHref ? (
            <Button
              asChild
              size="sm"
              className="h-8 px-3 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white border-0 shadow-sm shrink-0"
            >
              <Link href={payNowHref}>
                <CreditCard className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                {language === 'en' ? 'Pay now' : 'Оплатить'}
              </Link>
            </Button>
          ) : null}
          {!isAdminView && onSupportClick ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs border-slate-200 text-slate-800 hover:bg-slate-50 inline-flex items-center"
              onClick={onSupportClick}
              disabled={supportLoading}
              title={supportPriorityActive ? `${supportLabel} — ${supportDoneLabel}` : supportLabel}
            >
              {supportLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              ) : (
                <LifeBuoy className="h-3.5 w-3.5 shrink-0 text-teal-600" />
              )}
              <span className="ml-1.5 max-w-[7rem] sm:max-w-none truncate">{supportLabel}</span>
              {supportPriorityActive ? (
                <span className="ml-1 hidden sm:inline text-[10px] font-normal text-amber-700 truncate max-w-[5.5rem]">
                  ({supportDoneLabel})
                </span>
              ) : null}
            </Button>
          ) : null}
          {children ? <div className="flex items-center gap-2">{children}</div> : null}
        </div>
      </div>
      {showBookingTimeline && booking ? (
        <BookingChatTimeline booking={booking} language={language} />
      ) : null}
    </div>
  )
}

function safeFormat(iso) {
  try {
    return format(new Date(iso), 'd MMM yyyy', { locale: ru })
  } catch {
    return null
  }
}
