'use client'

/**
 * ChatContext — единый источник истины для состояния чата.
 *
 * Что делает:
 *  - Один раз загружает список бесед (?archived=all, чтобы учесть архив).
 *  - Подписывается на Supabase Realtime и дебоунсит перезагрузку при изменениях.
 *  - Вычисляет totalUnread (включая архивированные беседы с новыми сообщениями).
 *  - Глобально обновляет document.title с префиксом (n) на всех страницах.
 *  - Предоставляет утилиты: markConversationRead, getConversationForListing, refresh.
 *
 * Используется через хук useChatContext():
 *   const { totalUnread, conversations, getConversationForListing } = useChatContext()
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
import { useRealtimeConversations } from '@/hooks/use-realtime-chat'

const ChatContext = createContext(null)

/** Safe defaults — возвращаются когда компонент рендерится вне ChatProvider */
const SAFE_DEFAULTS = {
  conversations: [],
  totalUnread: 0,
  loaded: false,
  loading: false,
  refresh: () => {},
  markConversationRead: () => {},
  getConversationForListing: () => null,
}

export function ChatProvider({ children }) {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const [conversations, setConversations] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)

  // ─── Fetch ───────────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!userId) {
      setConversations([])
      setLoaded(true)
      return
    }
    setLoading(true)
    try {
      // archived=all → включает архивированные беседы, чтобы видеть их unread
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
      // silent — некритичный фоновый запрос
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }, [userId])

  useEffect(() => {
    refresh()
  }, [refresh])

  // ─── Realtime ─────────────────────────────────────────────────────────────
  useRealtimeConversations(userId, () => refresh())

  // ─── Вычисляемые значения ─────────────────────────────────────────────────
  /**
   * Все беседы, которые НЕ архивированы текущим пользователем.
   * Это то, что видит inbox.
   */
  const activeConversations = useMemo(() => {
    if (!userId) return conversations
    return conversations.filter((c) => {
      if (c.renterId && String(c.renterId) === String(userId) && c.renterArchivedAt) return false
      if (c.partnerId && String(c.partnerId) === String(userId) && c.partnerArchivedAt) return false
      return true
    })
  }, [conversations, userId])

  /**
   * totalUnread = сумма по ВСЕМ беседам (включая архив).
   * Если в архивной беседе пришло новое сообщение — оно отражается в счётчике.
   */
  const totalUnread = useMemo(() => {
    return conversations.reduce(
      (sum, c) => sum + (Number(c.unreadCount) || 0),
      0,
    )
  }, [conversations])

  // ─── document.title ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!loaded) return
    // Снимаем старый числовой префикс (если был), затем добавляем новый
    const base = document.title.replace(/^\(\d+\)\s*/, '')
    document.title = totalUnread > 0 ? `(${totalUnread}) ${base}` : base
  }, [totalUnread, loaded])

  // ─── Утилиты ──────────────────────────────────────────────────────────────
  /** Мгновенно обнуляет unread для указанной беседы (оптимистичный update). */
  const markConversationRead = useCallback((conversationId) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c,
      ),
    )
  }, [])

  /** Возвращает беседу по listingId (или null). Используется на странице листинга. */
  const getConversationForListing = useCallback(
    (listingId) => {
      if (!listingId) return null
      return (
        conversations.find(
          (c) => String(c.listingId ?? '') === String(listingId),
        ) ?? null
      )
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
    [
      activeConversations,
      conversations,
      totalUnread,
      loaded,
      loading,
      refresh,
      markConversationRead,
      getConversationForListing,
    ],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

/**
 * Хук для доступа к ChatContext.
 * Безопасно возвращает дефолты, если вызван вне ChatProvider.
 */
export function useChatContext() {
  const ctx = useContext(ChatContext)
  return ctx ?? SAFE_DEFAULTS
}
