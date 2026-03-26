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
import { useRealtimeMessages } from '@/hooks/use-realtime-chat'
import { useOptimisticSend } from '@/hooks/use-optimistic-send'
import { playNotificationSound } from '@/hooks/use-realtime-chat'
import { uploadChatFile } from '@/lib/chat-upload'

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
function buildMapperOpts(conv, userId, viewerRole) {
  return {
    viewerUserId: userId ?? null,
    bookingStatus: conv?.booking?.status ?? conv?.bookingStatus ?? null,
    viewerRole: viewerRole ?? null,
    listingCategory: conv?.listingCategory ?? null,
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
  const [isLoading, setIsLoading] = useState(false)
  const [selectedConv, setSelectedConv] = useState(null)
  const [listing, setListing] = useState(null)
  const [booking, setBooking] = useState(null)

  // Защита от race condition при быстром переключении диалогов
  const loadSeqRef = useRef(0)

  // Текущие опции маппера — обновляются вместе с selectedConv
  const mapperOptsRef = useRef(buildMapperOpts(null, userId, viewerRole))
  useEffect(() => {
    mapperOptsRef.current = buildMapperOpts(selectedConv, userId, viewerRole)
    // При смене bookingStatus — перемаппируем весь список (для актуализации маскировки)
    if (selectedConv) {
      setMessages((prev) =>
        prev.map((m) => mapApiMessageToRow(m, mapperOptsRef.current) ?? m)
      )
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConv?.booking?.status, userId, viewerRole])

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

        if (fromPeer) {
          playNotificationSound()
          if (onNewMessageRef.current) onNewMessageRef.current(mapped)
          // Авто-пометка прочитанным (подхватится useMarkConversationRead снаружи)
          onMarkReadRef.current?.()
        }
      }
    },
    [userId]
  )

  const handleRealtimeUpdate = useCallback((rawRow) => {
    setMessages((prev) =>
      mergeRealtimeMessage(prev, rawRow, mapperOptsRef.current)
    )
  }, [])

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
      mapperOptsRef.current = buildMapperOpts(conv, userId, viewerRole)

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
    } catch (err) {
      console.error('[useChatThreadMessages] loadThread error:', err)
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
        const voiceUrl = await uploadChatFile(blob, {
          folder: 'voice',
          fileName: `voice_${Date.now()}.webm`,
        })
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
        const url = await uploadChatFile(file, { folder: type === 'image' ? 'images' : 'files' })
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
    () => buildMapperOpts(selectedConv, userId, viewerRole),
    [selectedConv, userId, viewerRole]
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
