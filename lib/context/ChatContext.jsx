'use client'

/**
 * ChatContext — единый источник истины для состояния чата.
 *
 * v2 — Smart Realtime (точечный merge без полной перезагрузки):
 *  - При INSERT/UPDATE в таблице `conversations` → обновляем только одну запись.
 *  - При INSERT в таблице `messages` → обновляем lastMessage + unreadCount + sort to top.
 *  - При новом сообщении в архивной беседе → автоматически разархивируем.
 *  - refresh() вызывается ТОЛЬКО при начальной загрузке и при INSERT новой беседы.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'

const ChatContext = createContext(null)

const SAFE_DEFAULTS = {
  conversations: [],
  allConversations: [],
  totalUnread: 0,
  loaded: false,
  loading: false,
  refresh: () => {},
  markConversationRead: () => {},
  getConversationForListing: () => null,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Мёрджит поля сырой DB-строки (snake_case) в уже закешированную mapped-беседу.
 * Сохраняет обогащённые поля: listing, booking, lastMessage, unreadCount.
 */
function mergeRawConvUpdate(mapped, raw) {
  return {
    ...mapped,
    statusLabel: raw.status_label ?? raw.status ?? mapped.statusLabel,
    lastMessageAt: raw.last_message_at ?? mapped.lastMessageAt,
    updatedAt: raw.updated_at ?? mapped.updatedAt,
    isPriority: raw.is_priority === true,
    renterArchivedAt: raw.renter_archived_at ?? null,
    partnerArchivedAt: raw.partner_archived_at ?? null,
    partnerName: raw.partner_name ?? mapped.partnerName,
    renterName: raw.renter_name ?? mapped.renterName,
  }
}

/**
 * Строит новый lastMessage из raw DB строки сообщения.
 */
function rawMsgToLastMessage(raw) {
  return {
    id: raw.id,
    content: raw.content ?? raw.message,
    message: raw.message ?? raw.content,
    type: raw.type,
    createdAt: raw.created_at,
    created_at: raw.created_at,
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ChatProvider({ children }) {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const [conversations, setConversations] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)

  // Реф для доступа к актуальному userId внутри Realtime-замыканий
  const userIdRef = useRef(userId)
  useEffect(() => { userIdRef.current = userId }, [userId])

  // ─── Начальная загрузка ───────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    const uid = userIdRef.current
    if (!uid) {
      setConversations([])
      setLoaded(true)
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/v2/chat/conversations?archived=all&limit=100', {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!res.ok) return
      const data = await res.json()
      if (data?.success && Array.isArray(data.data)) {
        setConversations(data.data)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }, []) // intentionally no deps — uses ref

  useEffect(() => {
    refresh()
  }, [refresh, userId]) // перезагружаем при смене пользователя

  // ─── Загрузка одной беседы (для INSERT новой беседы) ──────────────────────
  const fetchOneConversation = useCallback(async (convId) => {
    try {
      const res = await fetch(
        `/api/v2/chat/conversations?id=${encodeURIComponent(convId)}`,
        { credentials: 'include', cache: 'no-store' },
      )
      if (!res.ok) return
      const data = await res.json()
      const conv = data?.data?.[0]
      if (!conv) return
      setConversations((prev) => {
        if (prev.some((c) => c.id === conv.id)) return prev
        return [conv, ...prev]
      })
    } catch {
      // silent
    }
  }, [])

  // ─── Разархивирование (fire-and-forget) ───────────────────────────────────
  const unarchiveConversation = useCallback(async (convId) => {
    try {
      await fetch(`/api/v2/chat/conversations`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId, archived: false }),
      })
    } catch {
      // silent — UI already updated optimistically
    }
  }, [])

  // ─── Smart Realtime ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!supabase || !userId) return

    // Channel 1: изменения в таблице conversations (point merge)
    const convChannel = supabase
      .channel(`ctx-convs:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setConversations((prev) => {
              const idx = prev.findIndex((c) => c.id === payload.new.id)
              if (idx === -1) return prev
              const next = [...prev]
              next[idx] = mergeRawConvUpdate(prev[idx], payload.new)
              return next
            })
          } else if (payload.eventType === 'INSERT') {
            // Новая беседа — нужно обогащение через API
            fetchOneConversation(payload.new.id)
          }
        },
      )
      .subscribe()

    // Channel 2: новые сообщения → обновляем lastMessage + unreadCount + sort
    const msgChannel = supabase
      .channel(`ctx-messages:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new
          const convId = msg.conversation_id
          const uid = userIdRef.current
          if (!convId || !uid) return

          setConversations((prev) => {
            const idx = prev.findIndex((c) => c.id === convId)
            if (idx === -1) return prev // беседа не в нашем списке

            const conv = prev[idx]
            const isFromMe = String(msg.sender_id) === String(uid)

            // Проверяем: нужно ли разархивировать?
            const iAmRenter = String(conv.renterId) === String(uid)
            const iAmPartner = String(conv.partnerId) === String(uid)
            const wasArchivedByMe =
              (!isFromMe && iAmRenter && conv.renterArchivedAt) ||
              (!isFromMe && iAmPartner && conv.partnerArchivedAt)

            const updated = {
              ...conv,
              lastMessage: rawMsgToLastMessage(msg),
              lastMessageAt: msg.created_at,
              // Инкрементируем unread только если сообщение не от нас
              unreadCount: isFromMe ? conv.unreadCount || 0 : (conv.unreadCount || 0) + 1,
              // Авто-разархивирование при входящем сообщении
              renterArchivedAt:
                !isFromMe && iAmRenter ? null : conv.renterArchivedAt,
              partnerArchivedAt:
                !isFromMe && iAmPartner ? null : conv.partnerArchivedAt,
            }

            // Fire-and-forget патч на бэкенд при разархивировании
            if (wasArchivedByMe) {
              unarchiveConversation(convId)
            }

            // Поднимаем беседу в начало списка
            const next = prev.filter((c) => c.id !== convId)
            return [updated, ...next]
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(convChannel)
      supabase.removeChannel(msgChannel)
    }
  }, [userId, fetchOneConversation, unarchiveConversation])

  // ─── Вычисляемые значения ─────────────────────────────────────────────────

  /** Беседы без архива — то что видит инбокс. */
  const activeConversations = useMemo(() => {
    if (!userId) return conversations
    return conversations.filter((c) => {
      if (c.renterId && String(c.renterId) === String(userId) && c.renterArchivedAt) return false
      if (c.partnerId && String(c.partnerId) === String(userId) && c.partnerArchivedAt) return false
      return true
    })
  }, [conversations, userId])

  /** Сумма всех unread включая архив. */
  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + (Number(c.unreadCount) || 0), 0),
    [conversations],
  )

  // ─── document.title ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!loaded) return
    const base = document.title.replace(/^\(\d+\)\s*/, '')
    document.title = totalUnread > 0 ? `(${totalUnread}) ${base}` : base
  }, [totalUnread, loaded])

  // ─── Утилиты ──────────────────────────────────────────────────────────────

  const markConversationRead = useCallback((conversationId) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c,
      ),
    )
  }, [])

  const getConversationForListing = useCallback(
    (listingId) => {
      if (!listingId) return null
      return conversations.find(
        (c) => String(c.listingId ?? '') === String(listingId),
      ) ?? null
    },
    [conversations],
  )

  const value = useMemo(
    () => ({
      conversations: activeConversations,
      allConversations: conversations,
      totalUnread,
      loaded,
      loading,
      refresh,
      markConversationRead,
      getConversationForListing,
    }),
    [activeConversations, conversations, totalUnread, loaded, loading, refresh, markConversationRead, getConversationForListing],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChatContext() {
  return useContext(ChatContext) ?? SAFE_DEFAULTS
}
