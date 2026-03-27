'use client'

/**
 * @file components/sticky-chat-header.jsx
 *
 * Липкая шапка чат-треда.
 *
 * Отвечает за:
 *   – лейаут (липкость, тень, backdrop-blur)
 *   – Admin View banner + список участников
 *   – миниатюра листинга, название, район
 *   – имя собеседника + индикатор присутствия (зелёная/серая точка)
 *   – текст Online / Offline / «Был X назад»
 *   – индикатор «печатает…»
 *   – строка дат брони + статус
 *   – шкала прогресса брони (BookingChatTimeline)
 *
 * Кнопки действий (поддержка, оплатить, медиагалерея, поиск, Confirm/Decline)
 * вынесены в <ChatHeaderActions> и рендерятся через пропсы.
 */

import { useEffect, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { ru as ruLocale } from 'date-fns/locale'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Building2, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { BookingChatTimeline } from '@/components/booking-chat-timeline'
import { ChatHeaderActions } from '@/components/chat/ChatHeaderActions'

export function StickyChatHeader({
  listing,
  booking,
  isAdminView = false,
  contactName,
  presenceOnline = null,
  lastSeenAt = null,
  onSupportClick = null,
  supportLoading = false,
  supportPriorityActive = false,
  adminParticipants = null,
  supportLabel = 'Помощь',
  supportDoneLabel = 'В очереди у поддержки',
  partnerBookingActions = null,
  typingIndicator = null,
  typingGateWithPresence = true,
  language = 'ru',
  showBookingTimeline = true,
  payNowHref = null,
  onMediaGallery = null,
  onSearchToggle = null,
  /** Мобиле: открыть детали сделки (Sheet); на lg+ кнопка скрыта — панель в ChatThreadChrome */
  onDealInfoClick = null,
  searchActive = false,
  embedded = false,
  compact = false,
  /** К списку диалогов */
  messagesListHref = null,
  messagesListBackLabel = null,
  /** `replace` — не копить историю (универсальный /messages/[id]); `push` — явный переход в инбокс (партнёрский кабинет) */
  messagesListBackNavigation = 'replace',
  /** Десктоп: «Поддержка / Медиа / Поиск» в одном меню «Ещё» — меньше шума в шапке */
  groupDesktopTools = false,
  className,
  children,
}) {
  const router = useRouter()

  // Ticker для обновления «Был X минут назад» каждые 30 секунд
  const [, setTick] = useState(0)
  useEffect(() => {
    if (presenceOnline || !lastSeenAt) return
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [presenceOnline, lastSeenAt])

  function getPresenceLabel() {
    const dateLocale =
      language === 'th' || language === 'zh' ? undefined
      : language !== 'en' ? ruLocale : undefined

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
    const RECENT_MS = 10 * 60 * 1000
    if (diff < RECENT_MS) {
      const rel = formatDistanceToNow(new Date(lastSeenAt), { addSuffix: true, locale: dateLocale })
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
      {/* Admin View banner */}
      {isAdminView && (
        <div className="bg-amber-50 border-b border-amber-200/80 px-4 py-2 text-center text-xs font-medium text-amber-950 flex items-center justify-center gap-2">
          <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>Admin View — доступ супервизора ко всем сообщениям в этом диалоге</span>
        </div>
      )}

      {/* Admin participants list */}
      {isAdminView && adminParticipants ? (
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200/80 text-xs text-slate-700 leading-relaxed">
          <p className="font-semibold text-slate-800 mb-1">Участники диалога</p>
          <ul className="list-disc list-inside space-y-0.5">
            {adminParticipants.renterName ? (
              <li>Гость: <span className="font-medium">{adminParticipants.renterName}</span></li>
            ) : null}
            {adminParticipants.partnerName ? (
              <li>Партнёр: <span className="font-medium">{adminParticipants.partnerName}</span></li>
            ) : null}
            {adminParticipants.bookingId ? (
              <li>Бронь: <span className="font-mono text-[11px]">{adminParticipants.bookingId}</span></li>
            ) : null}
            {!adminParticipants.renterName && !adminParticipants.partnerName ? (
              <li className="text-slate-500">Участники не указаны в карточке беседы</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {/* Основная строка: фото + инфо + кнопки */}
      <div
        className={cn(
          'flex w-full min-w-0 gap-2 items-center overflow-x-hidden sm:gap-3 sm:items-start',
          compact ? 'px-2 py-2 sm:px-4 sm:py-3' : 'px-4 py-3'
        )}
      >
        {messagesListHref ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 -ml-1 xl:hidden"
            aria-label={
              messagesListBackLabel
                ?? (language === 'en' ? 'Back to conversations' : 'К списку диалогов')
            }
            onClick={() => {
              if (messagesListBackNavigation === 'push') {
                router.push(messagesListHref, { scroll: false })
              } else {
                router.replace(messagesListHref, { scroll: false })
              }
            }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        ) : null}

        {/* Миниатюра листинга */}
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

        {/* Текстовая информация (левая колонка) */}
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

          {/* Имя собеседника + точка присутствия */}
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
                    presenceOnline
                      ? 'bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.25)] animate-pulse'
                      : 'bg-slate-300'
                  }`}
                  aria-hidden
                />
              )}
            </p>
          ) : null}

          {/* Текст статуса присутствия */}
          {presenceOnline !== null && !typingIndicator ? (
            <p
              className={cn(
                'mt-0.5 truncate',
                compact ? 'text-[10px] sm:text-[11px]' : 'text-[11px]',
                presenceOnline ? 'text-emerald-600 font-medium' : 'text-slate-400'
              )}
            >
              {getPresenceLabel()}
            </p>
          ) : null}

          {/* Индикатор «печатает…» */}
          {typingIndicator && (!typingGateWithPresence || presenceOnline !== false) ? (
            <p className="text-xs text-teal-600 mt-1 truncate animate-pulse" aria-live="polite">
              {typingIndicator}
            </p>
          ) : null}

          {dateLine}
        </div>

        {/* Правая колонка — кнопки действий */}
        <ChatHeaderActions
          isAdminView={isAdminView}
          partnerBookingActions={partnerBookingActions}
          payNowHref={payNowHref}
          onSupportClick={onSupportClick}
          supportLoading={supportLoading}
          supportPriorityActive={supportPriorityActive}
          supportLabel={supportLabel}
          supportDoneLabel={supportDoneLabel}
          onMediaGallery={onMediaGallery}
          onSearchToggle={onSearchToggle}
          onDealInfoClick={onDealInfoClick}
          searchActive={searchActive}
          language={language}
          compact={compact}
          groupDesktopTools={groupDesktopTools}
        >
          {children}
        </ChatHeaderActions>
      </div>

      {/* Шкала прогресса брони */}
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
