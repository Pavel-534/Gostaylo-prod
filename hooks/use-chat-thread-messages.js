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
import { REALTIME_MESSAGE_INSERT_EVENT } from '@/lib/chat/realtime-thread-bridge'
import { useRealtimeMessages } from '@/hooks/use-realtime-chat'
import { useOptimisticSend } from '@/hooks/use-optimistic-send'
import { uploadChatFile, uploadChatVoice } from '@/lib/chat-upload'

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
      const isSystem = String(rawMsg.type || '').toLowerCase() === 'system'
      const fromPeer = String(rawMsg.sender_id) !== String(userId)

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
    [userId]
  )

  const handleRealtimeUpdate = useCallback((rawRow) => {
    setMessages((prev) =>
      mergeRealtimeMessage(prev, rawRow, mapperOptsRef.current)
    )
  }, [])

  const handleRealtimeInsertRef = useRef(handleRealtimeInsert)
  useEffect(() => {
    handleRealtimeInsertRef.current = handleRealtimeInsert
  }, [handleRealtimeInsert])

  /** Дублирует INSERT из ChatContext (ctx-messages), если вторая подписка треда не сработала. */
  useEffect(() => {
    if (!conversationId) return
    const onBridge = (e) => {
      const raw = e?.detail?.message
      if (!raw || String(raw.conversation_id ?? '') !== String(conversationId)) return
      handleRealtimeInsertRef.current?.(raw)
    }
    window.addEventListener(REALTIME_MESSAGE_INSERT_EVENT, onBridge)
    return () => window.removeEventListener(REALTIME_MESSAGE_INSERT_EVENT, onBridge)
  }, [conversationId])

  const { isConnected } = useRealtimeMessages(
    conversationId ?? null,
    handleRealtimeInsert,
    handleRealtimeUpdate
  )

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
      const convRes = await fetch(
        `/api/v2/chat/conversations?id=${encodeURIComponent(convId)}&enrich=1`,
        { credentials: 'include' }
      )
      const convJson = await convRes.json()

      if (seq !== loadSeqRef.current) return
      if (!convRes.ok || !convJson.success) {
        if (convJson?.error === 'Forbidden') {
          toast.error('Нет доступа к этому диалогу')
        }
        return
      }

      const conv = convJson.data?.[0]
      if (!conv) return

      setSelectedConv(conv)
      setListing(conv.listing ?? null)
      setBooking(conv.booking ?? null)

      // Обновляем опции маппера до загрузки сообщений
      mapperOptsRef.current = buildMapperOpts(conv, userId, viewerRole, conv.booking ?? null)

      // 2. Загружаем историю сообщений
      const msgRes = await fetch(
        `/api/v2/chat/messages?conversationId=${encodeURIComponent(convId)}`,
        { credentials: 'include' }
      )
      const msgJson = await msgRes.json()

      if (seq !== loadSeqRef.current) return
      if (msgJson.success && Array.isArray(msgJson.data)) {
        const opts = mapperOptsRef.current
        setMessages(
          msgJson.data
            .map((m) => mapApiMessageToRow(m, opts))
            .filter(Boolean)
        )
      } else {
        setMessages([])
      }

      // 3. Авто-пометка прочитанными
      onMarkReadRef.current?.()
      fetch('/api/v2/chat/read', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId }),
      }).catch(() => {})
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
  const sendVoice = useCallback(
    async (blob, durationSec = 0) => {
      if (!blob || !conversationId || !userId) return null
      try {
        const mime = blob.type || 'audio/webm'
        const ext = mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'm4a' : mime.includes('mpeg') ? 'mp3' : 'webm'
        const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: mime })
        const { url: voiceUrl } = await uploadChatVoice(file, userId)
        const res = await fetch('/api/v2/chat/messages', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId,
            content: '🎤',
            type: 'voice',
            metadata: { voice_url: voiceUrl, duration_sec: durationSec },
          }),
        })
        const json = await res.json()
        if (!res.ok || !json.success) {
          toast.error(json.error || 'Ошибка отправки голосового')
          return null
        }
        return json.data
      } catch {
        toast.error('Ошибка сети')
        return null
      }
    },
    [conversationId, userId]
  )

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
        const res = await fetch('/api/v2/chat/messages', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId,
            content: file.name,
            type,
            metadata: type === 'image' ? { image_url: url } : { file_url: url, file_name: file.name },
          }),
        })
        const json = await res.json()
        if (!res.ok || !json.success) {
          toast.error(json.error || 'Ошибка загрузки файла')
          return null
        }
        return json.data
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
    sendMedia,
    reload: () => conversationId && loadThread(conversationId),

    // Вспомогательное
    setMessages,   // escape hatch для страниц с кастомной логикой
    setBooking,    // обновление статуса брони из handleConfirmBooking / handleDecline
    setSelectedConv,
    mapperOpts,
  }
}
