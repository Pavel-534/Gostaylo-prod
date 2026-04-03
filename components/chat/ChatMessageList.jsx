'use client'

/**
 * @file components/chat/ChatMessageList.jsx
 *
 * «Сердце» переписки — рендерит ленту сообщений чата.
 *
 * Принимает массив `messages` уже обработанный маппером (Фаза 1),
 * группирует по датам и рисует нужный компонент для каждого типа.
 *
 * Поддерживаемые типы:
 *   text | image (+ коллаж) | file | rejection | voice | invoice | system | support_ticket
 *
 * Связь с Фазой 1:
 *   – groupConsecutiveImages из lib/chat/message-filters.js
 *   – _masked флаг из mapApiMessageToRow (визуальный индикатор скрытых контактов)
 *   – ChatDateSeparator разделяет по дням
 *
 * Использование:
 * ```jsx
 * <ChatMessageList
 *   messages={messages}
 *   userId={userId}
 *   language="ru"
 *   isBookingPaid={false}
 *   searchHighlight="привет"
 * />
 * ```
 */

import { Fragment, useEffect, useRef, useCallback } from 'react'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

// Утилиты Фазы 1
import { groupConsecutiveImages } from '@/lib/chat/message-filters'
import { chatDayLabel, chatNeedsDaySeparator } from '@/lib/chat-date-labels'

// Презентационные компоненты (существующие)
import { ChatDateSeparator } from '@/components/chat-date-separator'
import { MessageBubble } from '@/components/message-bubble'
import { InvoiceBubble } from '@/components/invoice-bubble'
import { ChatMilestoneCard } from '@/components/chat-milestone-card'
import { ChatTransportUpsell } from '@/components/chat/ChatTransportUpsell'
import { isTransportUpsellAnchorMessage } from '@/lib/chat-transport-upsell-trigger'
import { buildTransportListingsUrl } from '@/lib/chat-transport-upsell-url'
import { ChatVoicePlayer } from '@/components/chat-voice-player'
import { ChatImageCollage } from '@/components/chat-image-collage'
import { ChatSupportTicketCard } from '@/components/chat-support-ticket-card'
import { SupportJoinedBanner } from '@/components/chat/SupportJoinedBanner'

// ─── Вспомогательный блок: замаскированные контакты ─────────────────────────

/**
 * Маленький лок-бейдж — показываем когда msg._masked === true,
 * то есть маппер заменил контакты в этом сообщении.
 */
function MaskedBadge({ language = 'ru' }) {
  const label =
    language === 'en'
      ? 'Contact hidden until booking is paid on the platform'
      : 'Контакт скрыт до оплаты бронирования на платформе'
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 mt-1 select-none"
      title={label}
    >
      <Lock className="h-2.5 w-2.5 shrink-0" />
      {language === 'en' ? 'Hidden' : 'Скрыто'}
    </span>
  )
}

// ─── Рендер одного «элемента» ленты ─────────────────────────────────────────

/**
 * Рендерит один элемент ленты: обычное сообщение, группу изображений, и т.д.
 * Вынесено в отдельную функцию для читаемости.
 */
function MessageItem({
  item,
  userId,
  language,
  isBookingPaid,
  searchHighlight,
  ownVariant,
  userRole,
  onInvoiceCancelled,
  booking,
  listing,
}) {
  // ── Группа изображений (коллаж) ────────────────────────────────────────────
  if (item._imageGroup) {
    const first = item.messages[0]
    const isOwn = String(first.sender_id) === String(userId)
    return (
      <div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
        <ChatImageCollage
          images={item.messages.map((m) => ({
            id: m.id,
            url: m.metadata?.image_url || m.metadata?.url,
            alt: m.message || '',
          }))}
          isOwn={isOwn}
        />
      </div>
    )
  }

  const msg = item
  const isOwn = String(msg.sender_id) === String(userId)
  const msgType = String(msg.type || '').toLowerCase()
  const meta = msg.metadata || {}

  // ── Support ticket ────────────────────────────────────────────────────────
  const st = meta.support_ticket
  if (st?.category && st?.disputeType) {
    return (
      <div className="flex justify-center px-1">
        <div className="w-full max-w-lg">
          <ChatSupportTicketCard ticket={st} senderName={msg.sender_name} language={language} />
        </div>
      </div>
    )
  }

  // ── Support joined (banner, not milestone card) ───────────────────────────
  if (msgType === 'system' && meta.system_key === 'support_joined') {
    return (
      <div className="flex w-full justify-center px-2 py-1 sm:px-4">
        <SupportJoinedBanner message={msg} language={language} />
      </div>
    )
  }

  // ── Системное сообщение (milestone) ───────────────────────────────────────
  if (msgType === 'system') {
    const showTransportUpsell =
      (userRole === 'renter' || userRole == null) &&
      booking &&
      isTransportUpsellAnchorMessage(msg)
    const transportHref = showTransportUpsell
      ? buildTransportListingsUrl({ listing, booking })
      : null
    return (
      <>
        <ChatMilestoneCard message={msg} language={language} userRole={userRole} />
        {transportHref ? (
          <div className="mt-1 flex w-full justify-center px-2.5 sm:px-4">
            <ChatTransportUpsell href={transportHref} language={language} />
          </div>
        ) : null}
      </>
    )
  }

  // ── Голосовое ─────────────────────────────────────────────────────────────
  if (msgType === 'voice' && meta.voice_url) {
    return (
      <div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
        <ChatVoicePlayer
          url={meta.voice_url}
          durationSec={meta.duration_sec || 0}
          isOwn={isOwn}
          ownVariant={ownVariant}
        />
      </div>
    )
  }

  // ── Инвойс ────────────────────────────────────────────────────────────────
  const isInvoice = msgType === 'invoice' || msg.type === 'INVOICE'
  if (isInvoice && meta.invoice) {
    return (
      <div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
        <InvoiceBubble
          invoice={meta.invoice}
          isOwn={isOwn}
          showPay={!isOwn}
          paymentMethod={meta.invoice.payment_method}
          messageId={isOwn ? msg.id : undefined}
          language={language}
          onInvoiceCancelled={
            isOwn && typeof onInvoiceCancelled === 'function'
              ? () => onInvoiceCancelled(msg.id)
              : undefined
          }
        />
      </div>
    )
  }

  // ── Обычный пузырь: text / image / file / rejection ───────────────────────
  const isAdmin = msg.sender_role === 'ADMIN' || msg.sender_role === 'MODERATOR'
  const isRejection = msgType === 'rejection'

  return (
    <div className="flex flex-col">
      <MessageBubble
        msg={msg}
        isOwn={isOwn}
        isAdmin={isAdmin}
        isRejection={isRejection}
        showSenderName={!isOwn}
        senderName={msg.sender_name || (language === 'ru' ? 'Пользователь' : 'User')}
        // Маскировка уже применена маппером; передаём false чтобы не маскировать дважды
        maskContacts={false}
        searchHighlight={searchHighlight}
        ownVariant={ownVariant}
        translateTargetLang={language}
      />
      {/* Индикатор скрытых контактов — когда mapper заменил данные */}
      {msg._masked && !isOwn && (
        <div className="pl-3 pb-1">
          <MaskedBadge language={language} />
        </div>
      )}
    </div>
  )
}

// ─── Главный компонент ────────────────────────────────────────────────────────

/**
 * @param {Object}   props
 * @param {Array}    props.messages         — массив ChatMessage (после mapApiMessageToRow)
 * @param {string}   props.userId           — UUID текущего пользователя
 * @param {string}   [props.language]       — 'ru' | 'en' | 'th' | 'zh'
 * @param {boolean}  [props.isBookingPaid]  — статус оплаты (используется для InvoiceBubble)
 * @param {string}   [props.searchHighlight] — строка поиска для подсветки вхождений
 * @param {'teal'|'indigo'} [props.ownVariant] — цвет своих пузырей
 * @param {string}   [props.userRole]       — 'renter' | 'partner' — для CTA отзыва
 * @param {boolean}  [props.autoScroll]     — скролл к новым сообщениям (default: true)
 * @param {Function} [props.onInvoiceCancelled] — (messageId) => void — отмена инвойса
 * @param {object}   [props.booking] — бронь треда (даты, listings.district) для upsell «Транспорт»
 * @param {object}   [props.listing] — листинг диалога
 * @param {string}   [props.className]
 */
export function ChatMessageList({
  messages = [],
  userId,
  language = 'ru',
  isBookingPaid = false,
  searchHighlight,
  ownVariant = 'teal',
  userRole,
  autoScroll = true,
  onInvoiceCancelled,
  booking,
  listing,
  className,
}) {
  const bottomRef = useRef(null)
  const prevLengthRef = useRef(0)

  // Авто-скролл к последнему сообщению
  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (!autoScroll) return
    // Скроллим только если добавилось новое сообщение, а не при обновлении is_read
    if (messages.length > prevLengthRef.current) {
      scrollToBottom()
    }
    prevLengthRef.current = messages.length
  }, [messages.length, autoScroll, scrollToBottom])

  // Применяем группировку изображений (чистая функция из Фазы 1)
  const items = groupConsecutiveImages(messages)

  return (
    <div
      className={cn(
        'flex w-full min-w-0 max-w-full flex-col gap-0 px-2.5 py-2 pb-24 sm:px-4 sm:py-3 sm:pb-24',
        className,
      )}
    >
      {items.map((item, idx, arr) => {
        // Вычисляем дату для разделителя
        const msgDate = item._imageGroup
          ? item.messages[0].created_at || item.messages[0].createdAt
          : item.created_at || item.createdAt

        const prevItem = arr[idx - 1]
        const prevDate = prevItem
          ? prevItem._imageGroup
            ? prevItem.messages[prevItem.messages.length - 1].created_at ||
              prevItem.messages[prevItem.messages.length - 1].createdAt
            : prevItem.created_at || prevItem.createdAt
          : null

        const showDay = chatNeedsDaySeparator(prevDate, msgDate)
        const dayLabel = chatDayLabel(msgDate, language)

        return (
          <Fragment key={item._imageGroup ? item.id : item.id}>
            {showDay && <ChatDateSeparator label={dayLabel} />}
            <div className="py-0.5">
              <MessageItem
                item={item}
                userId={userId}
                language={language}
                isBookingPaid={isBookingPaid}
                searchHighlight={searchHighlight}
                ownVariant={ownVariant}
                userRole={userRole}
                onInvoiceCancelled={onInvoiceCancelled}
                booking={booking}
                listing={listing}
              />
            </div>
          </Fragment>
        )
      })}

      {/* Якорь для автоскролла */}
      <div ref={bottomRef} className="h-px" aria-hidden="true" />
    </div>
  )
}
