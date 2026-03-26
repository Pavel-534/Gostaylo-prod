'use client'

import { useEffect, useRef, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { ru as ruLocale } from 'date-fns/locale'
import Link from 'next/link'
import { Building2, Check, CreditCard, Images, LifeBuoy, Loader2, Search, Shield, X } from 'lucide-react'
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
  /** ISO-строка или Date — когда собеседник был в последний раз онлайн */
  lastSeenAt = null,
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
  /** Кнопка медиа-галереи 🖼️ */
  onMediaGallery = null,
  /** Кнопка поиска 🔍 */
  onSearchToggle = null,
  /** Поиск активен (подсвечивает кнопку) */
  searchActive = false,
  /**
   * Вложенный чат (партнёрский layout): без position:sticky — иначе при скролле страницы
   * шапка прилипает к top вьюпорта и уезжает под фиксированный mobile header.
   */
  embedded = false,
  /** Узкая шапка на мобилках: меньше отступы, мельче типографика, действия в один ряд */
  compact = false,
  className,
  children,
}) {
  // ── Ticker для "Был недавно" — обновляет текст каждые 30 секунд ──────────
  const [, setTick] = useState(0)
  useEffect(() => {
    if (presenceOnline || !lastSeenAt) return
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [presenceOnline, lastSeenAt])

  function getPresenceLabel(language) {
    const dateLocale = language === 'th' || language === 'zh' ? undefined : language !== 'en' ? ruLocale : undefined
    if (presenceOnline) {
      if (language === 'th') return 'ออนไลน์'
      if (language === 'zh') return '在线'
      return language === 'en' ? 'Online' : 'В сети'
    }
    if (!lastSeenAt) {
      if (language === 'th') return 'ออฟไลน์'
      if (language === 'zh') return '离线'
      return language === 'en' ? 'Offline' : 'Не в сети'
    }
    const diff = Date.now() - new Date(lastSeenAt).getTime()
    const RECENT_MS = 10 * 60 * 1000 // 10 минут
    if (diff < RECENT_MS) {
      const rel = formatDistanceToNow(new Date(lastSeenAt), {
        addSuffix: true,
        locale: dateLocale,
      })
      if (language === 'th') return `เห็นล่าสุดเมื่อ ${rel}`
      if (language === 'zh') return `最后在线 ${rel}`
      return language === 'en' ? `Last seen ${rel}` : `Был(а) ${rel}`
    }
    if (language === 'th') return 'ออฟไลน์'
    if (language === 'zh') return '离线'
    return language === 'en' ? 'Offline' : 'Не в сети'
  }

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
      <p
        className={cn(
          'text-slate-600 flex flex-wrap items-center gap-x-1 gap-y-1',
          compact ? 'text-[11px] sm:text-sm' : 'text-sm'
        )}
      >
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
    <div
      className={cn(
        'border-b bg-white',
        embedded
          ? 'relative z-[15] shadow-none'
          : 'sticky top-0 z-20 bg-white/95 shadow-sm backdrop-blur',
        className
      )}
    >
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
      <div
        className={cn(
          'flex gap-2 items-center sm:gap-3 sm:items-start',
          compact ? 'px-2 py-2 sm:px-4 sm:py-3' : 'px-4 py-3'
        )}
      >
        {img ? (
          <img
            src={img}
            alt=""
            className={cn(
              'rounded-lg object-cover shrink-0 border border-slate-100',
              compact ? 'w-10 h-10 sm:w-14 sm:h-14' : 'w-14 h-14'
            )}
          />
        ) : (
          <div
            className={cn(
              'rounded-lg bg-slate-100 flex items-center justify-center shrink-0',
              compact ? 'w-10 h-10 sm:w-14 sm:h-14' : 'w-14 h-14'
            )}
          >
            <Building2 className={cn('text-slate-400', compact ? 'h-5 w-5 sm:h-7 sm:w-7' : 'h-7 w-7')} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {listing?.id ? (
            <Link
              href={`/listings/${listing.id}`}
              className={cn(
                'font-semibold text-slate-900 truncate block hover:text-teal-700',
                compact && 'text-sm sm:text-base'
              )}
            >
              {title}
            </Link>
          ) : (
            <p className={cn('font-semibold text-slate-900 truncate', compact && 'text-sm sm:text-base')}>
              {title}
            </p>
          )}
          {listing?.district ? (
            <p className={cn('text-slate-500 truncate', compact ? 'text-[11px] sm:text-xs' : 'text-xs')}>
              {listing.district}
            </p>
          ) : null}
          {contactName ? (
            <p
              className={cn(
                'font-medium text-slate-800 mt-0.5 flex items-center gap-2',
                compact ? 'text-xs sm:text-sm' : 'text-sm'
              )}
            >
              {contactName}
              {presenceOnline !== null && (
                <span
                  className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                    presenceOnline ? 'bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.25)] animate-pulse' : 'bg-slate-300'
                  }`}
                  aria-hidden
                />
              )}
            </p>
          ) : null}
          {/* Статус "В сети / Был недавно" */}
          {presenceOnline !== null && !typingIndicator ? (
            <p
              className={cn(
                'mt-0.5 truncate',
                compact ? 'text-[10px] sm:text-[11px]' : 'text-[11px]',
                presenceOnline ? 'text-emerald-600 font-medium' : 'text-slate-400',
              )}
            >
              {getPresenceLabel(language)}
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
        <div
          className={cn(
            'shrink-0 flex items-center',
            compact
              ? 'flex-row flex-wrap justify-end gap-1.5 sm:flex-col sm:items-end sm:gap-2'
              : 'flex-col items-end gap-2'
          )}
        >
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
              className={cn(
                'border-slate-200 text-slate-800 hover:bg-slate-50 inline-flex items-center',
                compact
                  ? 'h-8 w-8 shrink-0 p-0 sm:h-8 sm:w-auto sm:px-2.5 sm:text-xs'
                  : 'h-8 px-2.5 text-xs'
              )}
              onClick={onSupportClick}
              disabled={supportLoading}
              title={supportPriorityActive ? `${supportLabel} — ${supportDoneLabel}` : supportLabel}
            >
              {supportLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              ) : (
                <LifeBuoy className="h-3.5 w-3.5 shrink-0 text-teal-600" />
              )}
              <span className={cn('truncate', compact ? 'hidden sm:ml-1.5 sm:inline sm:max-w-[7rem] md:max-w-none' : 'ml-1.5 max-w-[7rem] sm:max-w-none')}>
                {supportLabel}
              </span>
              {supportPriorityActive ? (
                <span className="ml-1 hidden sm:inline text-[10px] font-normal text-amber-700 truncate max-w-[5.5rem]">
                  ({supportDoneLabel})
                </span>
              ) : null}
            </Button>
          ) : null}
          {/* Медиа-галерея */}
          {onMediaGallery ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'text-slate-500 hover:bg-slate-100 hover:text-teal-700',
                compact ? 'h-8 w-8' : 'h-9 w-9',
              )}
              onClick={onMediaGallery}
              title={language === 'en' ? 'Media gallery' : 'Медиафайлы'}
              aria-label={language === 'en' ? 'Media gallery' : 'Медиафайлы'}
            >
              <Images className="h-4 w-4" />
            </Button>
          ) : null}

          {/* Поиск по сообщениям */}
          {onSearchToggle ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'hover:bg-slate-100',
                compact ? 'h-8 w-8' : 'h-9 w-9',
                searchActive ? 'text-teal-600 bg-teal-50 hover:bg-teal-100' : 'text-slate-500 hover:text-teal-700',
              )}
              onClick={onSearchToggle}
              title={language === 'en' ? 'Search messages' : 'Поиск по сообщениям'}
              aria-label={language === 'en' ? 'Search messages' : 'Поиск по сообщениям'}
            >
              <Search className="h-4 w-4" />
            </Button>
          ) : null}

          {children ? (
            <div className={cn('flex items-center gap-1.5 sm:gap-2', compact && 'shrink-0')}>{children}</div>
          ) : null}
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
    return format(new Date(iso), 'd MMM yyyy', { locale: ruLocale })
  } catch {
    return null
  }
}
