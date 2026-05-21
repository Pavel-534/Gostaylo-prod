'use client'

/**
 * @file hooks/use-chat-thread-messages.js
 *
 * Хук состояния треда (диалога): загрузка истории, Realtime-подписка,
 * оптимистичная отправка сообщений.
 *
 * Инкапсулирует всё, что ранее было разбросано по PartnerMessages / RenterMessages:
 *  – loadThreadSeq ref (race-condition guard)
 *  – загрузка messages + selectedConv + listing + booking через API
 *  – Realtime INSERT / UPDATE подписка (через useRealtimeMessages)
 *  – оптимистичная отправка текста и медиа (через useOptimisticSend)
 *  – mapApiMessageToRow (Фаза 1) для унифицированного формата
 *
 * Использование:
 * ```js
 * const {
 *   messages, isLoading,
 *   selectedConv, listing, booking,
 *   sendMessage, sendVoice, sendMedia,
 *   isConnected,
 * } = useChatThreadMessages({ conversationId, userId, viewerRole })
 * ```
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { toast } from 'sonner'

import { mapApiMessageToRow, mergeRealtimeMessage } from '@/lib/chat/map-api-message'
import { isMessageHiddenFromViewer } from '@/lib/chat-message-visibility'
import { isRealtimeDebugEnabled } from '@/lib/chat/realtime-debug-log'
import { useChatRealtime } from '@/hooks/use-chat-realtime'
import { useOptimisticSend } from '@/hooks/use-optimistic-send'
import { postChatMessage } from '@/lib/chat/post-chat-message'
import { postChatInvoice } from '@/lib/chat/post-chat-invoice'
import { uploadChatFile, uploadChatVoice } from '@/lib/chat-upload'
import { fetchEnrichedConversation } from '@/lib/chat/conversation-api-client'
import { fetchChatMessages, postChatMarkRead } from '@/lib/chat/chat-ui-api-client'

// ─── Утилита ─────────────────────────────────────────────────────────────────

/**
 * Строит опции маппера из контекста беседы.
 * Вызывается при каждой загрузке и при Realtime-событиях.
 *
 * @param {Object|null} conv         — enriched conversation
 * @param {string|null} userId       — ID текущего пользователя
 * @param {string|null} viewerRole   — роль просматривающего ('partner'|'renter'|'admin')
 * @returns {import('@/lib/chat/map-api-message').mapApiMessageToRow.opts}
 */
function buildMapperOpts(conv, userId, viewerRole, bookingState = null) {
  const bookingStatus =
    bookingState?.status ??
    conv?.booking?.status ??
    conv?.bookingStatus ??
    null
  const conversation = conv
    ? {
        renterId: conv.renterId,
        renter_id: conv.renterId,
        partnerId: conv.partnerId,
        partner_id: conv.partnerId,
        ownerId: conv.ownerId,
        owner_id: conv.ownerId,
      }
    : null
  return {
    viewerUserId: userId ?? null,
    bookingStatus,
    viewerRole: viewerRole ?? null,
    listingCategory: conv?.listingCategory ?? null,
    conversation,
  }
}

// ─── Хук ─────────────────────────────────────────────────────────────────────

/**
 * @param {Object}      opts
 * @param {string|null} opts.conversationId  — UUID активного треда
 * @param {string|null} opts.userId          — UUID текущего пользователя
 * @param {string}      [opts.viewerRole]    — 'partner' | 'renter' | 'admin'
 * @param {Function}    [opts.onMarkRead]    — callback вызывается после загрузки треда
 *                                             (например, для сброса badge в ChatContext)
 * @param {Function}    [opts.onNewMessage]  — callback при новом Realtime-сообщении от собеседника
 * @param {boolean}     [opts.deferThreadRealtime] — не подписываться на тред (SSOT: useConversationInbox)
 * @param {boolean}     [opts.externalIsConnected] — статус канала inbox при deferThreadRealtime
 *
 * @returns {{
 *   messages:      Array<import('@/lib/chat/map-api-message').ChatMessage>,
 *   isLoading:     boolean,
 *   isConnected:   boolean,
 *   selectedConv:  Object|null,
 *   listing:       Object|null,
 *   booking:       Object|null,
 *   sendMessage:   (content: string, extra?: Object) => Promise<Object|null>,
 *   sendVoice:     (blob: Blob, durationSec?: number) => Promise<Object|null>,
 *   sendMedia:     (file: File, type?: 'image'|'file') => Promise<Object|null>,
 *   reload:        () => void,
 * }}
 */
export function useChatThreadMessages({
  conversationId,
  userId,
  viewerRole = null,
  onMarkRead = null,
  onNewMessage = null,
  deferThreadRealtime = false,
  externalIsConnected = false,
}) {
  // ── Стейт ───────────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState([])
  /** true с первого кадра при открытом треде — избегаем «мигания» not-found до старта loadThread */
  const [isLoading, setIsLoading] = useState(() => Boolean(conversationId && userId))
  const [selectedConv, setSelectedConv] = useState(null)
  const [listing, setListing] = useState(null)
  const [booking, setBooking] = useState(null)

  const bookingRef = useRef(null)
  useEffect(() => {
    bookingRef.current = booking
  }, [booking])

  // Защита от race condition при быстром переключении диалогов
  const loadSeqRef = useRef(0)

  // Текущие опции маппера — обновляются вместе с selectedConv
  const mapperOptsRef = useRef(buildMapperOpts(null, userId, viewerRole, null))
  useEffect(() => {
    mapperOptsRef.current = buildMapperOpts(selectedConv, userId, viewerRole, booking)
    // При смене статуса брони (в т.ч. после Confirm на клиенте) — актуализируем маскировку
    if (selectedConv) {
      setMessages((prev) =>
        prev.map((m) => mapApiMessageToRow(m, mapperOptsRef.current) ?? m)
      )
    }
  }, [selectedConv, booking?.status, booking?.id, userId, viewerRole])

  // Ref-кэш колбэка для onNewMessage (предотвращаем лишние useEffect-перезапуски)
  const onNewMessageRef = useRef(onNewMessage)
  useEffect(() => { onNewMessageRef.current = onNewMessage }, [onNewMessage])
  const onMarkReadRef = useRef(onMarkRead)
  useEffect(() => { onMarkReadRef.current = onMarkRead }, [onMarkRead])

  // ── Realtime: входящие сообщения ─────────────────────────────────────────────

  const handleRealtimeInsert = useCallback(
    (rawMsg) => {
      if (isRealtimeDebugEnabled()) {
        // eslint-disable-next-line no-console -- диагностика доставки Realtime в тред
        console.info('NEW_MESSAGE_RECEIVED_IN_THREAD', {
          id: rawMsg?.id,
          conversation_id: rawMsg?.conversation_id ?? rawMsg?.conversationId,
          sender_id: rawMsg?.sender_id ?? rawMsg?.senderId,
        })
      }
      const isSystem = String(rawMsg.type || '').toLowerCase() === 'system'
      const fromPeer = String(rawMsg.sender_id) !== String(userId)

      if (isMessageHiddenFromViewer(rawMsg, userId, viewerRole)) {
        return
      }

      // Всегда применяем маппер, чтобы текст прошёл через maskContactInfo
      const mapped = mapApiMessageToRow(rawMsg, mapperOptsRef.current)
      if (!mapped) return

      if (fromPeer || isSystem) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === mapped.id)) return prev
          return [...prev, mapped]
        })

        if (isSystem) {
          const ev = rawMsg.metadata?.booking_status_event
          const bid = ev?.booking_id != null ? String(ev.booking_id) : ''
          const toStatus = ev?.to_status != null ? String(ev.to_status).toUpperCase() : ''
          const curBid = bookingRef.current?.id != null ? String(bookingRef.current.id) : ''
          if (bid && toStatus && curBid && bid === curBid) {
            setBooking((prev) => (prev ? { ...prev, status: toStatus } : prev))
            setSelectedConv((prev) => {
              if (!prev?.booking || String(prev.booking.id) !== bid) return prev
              return {
                ...prev,
                booking: { ...prev.booking, status: toStatus },
                bookingStatus: toStatus,
              }
            })
          }
        }

        if (fromPeer) {
          if (onNewMessageRef.current) onNewMessageRef.current(mapped)
          // Авто-пометка прочитанным (подхватится useMarkConversationRead снаружи)
          onMarkReadRef.current?.()
        }
      } else {
        // Своё сообщение пришло из Realtime раньше/вместо ответа POST — добавляем без дубликата
        setMessages((prev) => {
          if (prev.some((m) => m.id === mapped.id)) return prev
          return [...prev, mapped]
        })
      }
    },
    [userId, viewerRole]
  )

  const handleRealtimeUpdate = useCallback((rawRow) => {
    setMessages((prev) =>
      mergeRealtimeMessage(prev, rawRow, mapperOptsRef.current)
    )
  }, [])

  /** Подтягивание пропущенных сообщений после reconnect / возврата на вкладку (без F5). */
  const resyncMissedMessages = useCallback(async () => {
    if (!conversationId || !userId) return
    try {
      const { ok, data } = await fetchChatMessages(conversationId)
      if (!ok || !Array.isArray(data)) return
      const opts = mapperOptsRef.current
      const incoming = data
        .map((m) => mapApiMessageToRow(m, opts))
        .filter(Boolean)
      setMessages((prev) => {
        const byId = new Map(prev.map((m) => [m.id, m]))
        for (const m of incoming) {
          byId.set(m.id, m)
        }
        const next = Array.from(byId.values())
        next.sort((a, b) => {
          const ta = String(a.createdAt ?? a.created_at ?? '')
          const tb = String(b.createdAt ?? b.created_at ?? '')
          return ta.localeCompare(tb)
        })
        return next
      })
    } catch {
      /* ignore */
    }
  }, [conversationId, userId])

  const realtimeMessagesOpts = useMemo(
    () => ({ onResync: deferThreadRealtime ? undefined : resyncMissedMessages }),
    [deferThreadRealtime, resyncMissedMessages],
  )

  const realtimeConvId = deferThreadRealtime ? null : (conversationId ?? null)

  const { isConnected: threadRealtimeConnected } = useChatRealtime(
    realtimeConvId,
    handleRealtimeInsert,
    handleRealtimeUpdate,
    realtimeMessagesOpts,
  )

  const isConnected = deferThreadRealtime ? externalIsConnected : threadRealtimeConnected

  const prevInboxConnectedRef = useRef(false)
  useEffect(() => {
    if (!deferThreadRealtime || !conversationId) return
    const was = prevInboxConnectedRef.current
    prevInboxConnectedRef.current = externalIsConnected
    if (externalIsConnected && !was) {
      void resyncMissedMessages()
    }
  }, [deferThreadRealtime, externalIsConnected, conversationId, resyncMissedMessages])

  useEffect(() => {
    if (!deferThreadRealtime || !conversationId) return
    const onVis = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void resyncMissedMessages()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [deferThreadRealtime, conversationId, resyncMissedMessages])

  // ── Оптимистичная отправка текста ────────────────────────────────────────────

  const { sendText: _optimisticSendText } = useOptimisticSend({
    conversationId,
    userId,
    setMessages,
  })

  // ── Загрузка треда ────────────────────────────────────────────────────────────

  const loadThread = useCallback(async (convId) => {
    if (!convId || !userId) return

    const seq = ++loadSeqRef.current
    setIsLoading(true)
    setSelectedConv(null)
    setListing(null)
    setBooking(null)
    setMessages([])

    try {
      // 1. Загружаем обогащённую беседу (включает listing + booking)
      const conv = await fetchEnrichedConversation(convId)

      if (seq !== loadSeqRef.current) return
      if (!conv) return

      setSelectedConv(conv)
      setListing(conv.listing ?? null)
      setBooking(conv.booking ?? null)

      // Обновляем опции маппера до загрузки сообщений
      mapperOptsRef.current = buildMapperOpts(conv, userId, viewerRole, conv.booking ?? null)

      // 2. Загружаем историю сообщений
      const { ok: msgOk, data: msgRows } = await fetchChatMessages(convId)

      if (seq !== loadSeqRef.current) return
      if (msgOk && Array.isArray(msgRows)) {
        const opts = mapperOptsRef.current
        setMessages(
          msgRows
            .map((m) => mapApiMessageToRow(m, opts))
            .filter(Boolean)
        )
      } else {
        setMessages([])
      }

      // 3. Авто-пометка прочитанными
      onMarkReadRef.current?.()
      void postChatMarkRead(convId).catch(() => {})
    } catch {
      /* сеть / парсинг — тосты выше по цепочке */
    } finally {
      if (seq === loadSeqRef.current) setIsLoading(false)
    }
  }, [userId, viewerRole])

  // Автозапуск при смене conversationId или userId
  useEffect(() => {
    if (!conversationId || !userId) return
    loadThread(conversationId)
  }, [conversationId, userId, loadThread])

  // ── Публичные методы отправки ─────────────────────────────────────────────

  /**
   * Отправить текстовое сообщение (с оптимистичным UI).
   *
   * @param {string} content
   * @param {Object} [extra]  — доп. поля для тела запроса (skipPush, metadata, …)
   * @returns {Promise<Object|null>} server message или null при ошибке
   */
  const sendMessage = useCallback(
    async (content, extra = {}) => {
      return _optimisticSendText(content, extra)
    },
    [_optimisticSendText]
  )

  /**
   * Загрузить и отправить голосовое сообщение.
   *
   * @param {Blob}   blob
   * @param {number} [durationSec]
   * @returns {Promise<Object|null>}
   */
  const sendVoiceFromUrl = useCallback(
    async (voiceUrl, durationSec = 0) => {
      if (!voiceUrl || !conversationId || !userId) return null
      try {
        const { ok, data, error } = await postChatMessage({
          conversationId,
          content: '🎤',
          type: 'voice',
          metadata: { voice_url: voiceUrl, duration_sec: durationSec },
        })
        if (!ok) {
          toast.error(error || 'Ошибка отправки голосового')
          return null
        }
        return data
      } catch {
        toast.error('Ошибка сети')
        return null
      }
    },
    [conversationId, userId],
  )

  const sendVoice = useCallback(
    async (blob, durationSec = 0) => {
      if (!blob || !conversationId || !userId) return null
      try {
        const mime = blob.type || 'audio/webm'
        const ext = mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'm4a' : mime.includes('mpeg') ? 'mp3' : 'webm'
        const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: mime })
        const { url: voiceUrl } = await uploadChatVoice(file, userId)
        return sendVoiceFromUrl(voiceUrl, durationSec)
      } catch {
        toast.error('Ошибка сети')
        return null
      }
    },
    [conversationId, userId, sendVoiceFromUrl],
  )

  const sendPassportRequest = useCallback(async () => {
    if (!conversationId || !userId) return null
    try {
      const { ok, data, error } = await postChatMessage({
        conversationId,
        type: 'system',
        content: '',
        metadata: { system_key: 'passport_request' },
      })
      if (!ok) {
        toast.error(error || 'Ошибка отправки')
        return null
      }
      return data
    } catch {
      toast.error('Ошибка сети')
      return null
    }
  }, [conversationId, userId])

  const sendInvoice = useCallback(
    async (invoiceData) => {
      if (!conversationId || !userId) return { ok: false, data: null, error: 'No conversation' }
      try {
        return await postChatInvoice({
          conversationId,
          ...invoiceData,
          bookingId: invoiceData?.bookingId ?? booking?.id,
          listingId: invoiceData?.listingId ?? listing?.id,
          listingTitle: invoiceData?.listingTitle ?? listing?.title,
          checkIn: invoiceData?.checkIn ?? booking?.check_in,
          checkOut: invoiceData?.checkOut ?? booking?.check_out,
        })
      } catch {
        return { ok: false, data: null, error: 'Network error' }
      }
    },
    [conversationId, userId, booking, listing],
  )

  const appendMessage = useCallback((row) => {
    if (!row) return
    const mapped = mapApiMessageToRow(row, mapperOptsRef.current)
    if (mapped) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === mapped.id)) return prev
        return [...prev, mapped]
      })
    }
  }, [])

  /**
   * Загрузить и отправить файл/изображение.
   *
   * @param {File}   file
   * @param {'image'|'file'} [type]
   * @returns {Promise<Object|null>}
   */
  const sendMedia = useCallback(
    async (file, type = 'image') => {
      if (!file || !conversationId || !userId) return null
      try {
        const { url } = await uploadChatFile(file, userId, type === 'image' ? 'images' : 'files')
        const { ok, data, error } = await postChatMessage({
          conversationId,
          content: file.name,
          type,
          metadata: type === 'image' ? { image_url: url } : { file_url: url, file_name: file.name },
        })
        if (!ok) {
          toast.error(error || 'Ошибка загрузки файла')
          return null
        }
        return data
      } catch {
        toast.error('Ошибка сети')
        return null
      }
    },
    [conversationId, userId]
  )

  // ── Derived: маппер-опции для BookingActionBar и MessageBubble ──────────────

  /**
   * Текущие опции маппера — для передачи в компоненты, которым нужна bookingStatus.
   * Вынесено в мемо, чтобы не пересоздавался на каждый рендер.
   */
  const mapperOpts = useMemo(
    () => buildMapperOpts(selectedConv, userId, viewerRole, booking),
    [selectedConv, booking, userId, viewerRole]
  )

  return {
    // Данные
    messages,
    isLoading,
    isConnected,
    selectedConv,
    listing,
    booking,

    // Методы
    sendMessage,
    sendVoice,
    sendVoiceFromUrl,
    sendPassportRequest,
    sendInvoice,
    sendMedia,
    appendMessage,
    reload: () => conversationId && loadThread(conversationId),

    // Вспомогательное
    setMessages,   // escape hatch для страниц с кастомной логикой
    setBooking,    // обновление статуса брони из handleConfirmBooking / handleDecline
    setSelectedConv,
    mapperOpts,

    handleRealtimeInsert,
    handleRealtimeUpdate,
  }
}
