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
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { subscribeRealtimeWithBackoff } from '@/lib/chat/realtime-subscribe-with-backoff'
import { retainTypingGlobalChannel } from '@/lib/chat/typing-global-channel'
import { playNotificationSound } from '@/hooks/use-realtime-chat'

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
  typingByConversation: {},
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
  const pathname = usePathname()
  const lastRefreshNavRef = useRef(0)
  const lastRefreshVisRef = useRef(0)
  const prevPathnameRef = useRef(null)
  const conversationIdsRef = useRef(new Set())
  /** Дедуп запросов беседы, пришедших по Realtime до появления строки в списке (топ-100 / гонка загрузки). */
  const msgUnknownConvFetchRef = useRef(new Set())

  const [conversations, setConversations] = useState([])
  const [typingByConversation, setTypingByConversation] = useState({})
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    conversationIdsRef.current = new Set(
      (conversations || []).map((c) => String(c?.id || '')).filter(Boolean),
    )
  }, [conversations])

  const shouldPlayIncomingSound = useCallback(
    (conversationId) => {
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') return false
      const normalized = (pathname || '').replace(/\/+$/, '') || '/'
      const m = normalized.match(/^\/messages\/([^/?#]+)/)
      if (!m) return true
      const openConversationId = m?.[1] ? decodeURIComponent(m[1]) : null
      if (!openConversationId) return true
      return String(openConversationId) !== String(conversationId || '')
    },
    [pathname],
  )

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
      const res = await fetch('/api/v2/chat/conversations?archived=all&enrich=1&limit=100', {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!res.ok) return
      const data = await res.json()
      if (data?.success && Array.isArray(data.data)) {
        const rows = data.data
        // Синхронно с ответом API — иначе postgres_changes может прийти до useEffect и быть отброшен.
        conversationIdsRef.current = new Set(
          rows.map((c) => String(c?.id || '')).filter(Boolean),
        )
        setConversations(rows)
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
        `/api/v2/chat/conversations?id=${encodeURIComponent(convId)}&enrich=1`,
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

  // ─── Smart Realtime (с backoff при обрыве) ───────────────────────────────
  useEffect(() => {
    if (!supabase || !userId) return

    const onConvPayload = (payload) => {
      if (payload.eventType === 'UPDATE') {
        setConversations((prev) => {
          const idx = prev.findIndex((c) => c.id === payload.new.id)
          if (idx === -1) return prev
          const next = [...prev]
          next[idx] = mergeRawConvUpdate(prev[idx], payload.new)
          return next
        })
      } else if (payload.eventType === 'INSERT') {
        fetchOneConversation(payload.new.id)
      }
    }

    const onMsgPayload = (payload) => {
      const msg = payload.new
      const convId = msg.conversation_id
      const convKey = String(convId || '')
      const uid = userIdRef.current
      if (!convKey || !uid) return
      // RLS уже отдаёт только сообщения из «наших» бесед; не режем по ref — он отстаёт от state до конца refresh().

      let missingInList = false
      setConversations((prev) => {
        const idx = prev.findIndex((c) => String(c.id) === String(convId))
        if (idx === -1) {
          missingInList = true
          return prev
        }

        const conv = prev[idx]
        const isFromMe = String(msg.sender_id) === String(uid)
        const iAmRenter = String(conv.renterId) === String(uid)
        const iAmPartner = String(conv.partnerId) === String(uid)
        const wasArchivedByMe =
          (!isFromMe && iAmRenter && conv.renterArchivedAt) ||
          (!isFromMe && iAmPartner && conv.partnerArchivedAt)

        const updated = {
          ...conv,
          lastMessage: rawMsgToLastMessage(msg),
          lastMessageAt: msg.created_at,
          unreadCount: isFromMe ? conv.unreadCount || 0 : (conv.unreadCount || 0) + 1,
          renterArchivedAt: !isFromMe && iAmRenter ? null : conv.renterArchivedAt,
          partnerArchivedAt: !isFromMe && iAmPartner ? null : conv.partnerArchivedAt,
        }

        if (wasArchivedByMe) {
          unarchiveConversation(convId)
        }

        if (!isFromMe && shouldPlayIncomingSound(convId)) {
          playNotificationSound()
        }

        const next = prev.filter((c) => String(c.id) !== String(convId))
        return [updated, ...next]
      })

      if (missingInList && !msgUnknownConvFetchRef.current.has(convKey)) {
        msgUnknownConvFetchRef.current.add(convKey)
        void fetchOneConversation(convId).finally(() => {
          msgUnknownConvFetchRef.current.delete(convKey)
        })
      }
    }

    const stopConv = subscribeRealtimeWithBackoff({
      supabase,
      channelLabel: `chat:conversations:${userId}`,
      createChannel: (attempt) =>
        supabase
          .channel(`ctx-convs:${userId}:${attempt}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'conversations' },
            onConvPayload,
          ),
    })

    const stopMsg = subscribeRealtimeWithBackoff({
      supabase,
      channelLabel: `chat:messages:${userId}`,
      createChannel: (attempt) =>
        supabase
          .channel(`ctx-messages:${userId}:${attempt}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages' },
            onMsgPayload,
          ),
    })

    return () => {
      stopConv()
      stopMsg()
    }
  }, [userId, fetchOneConversation, unarchiveConversation, refresh, shouldPlayIncomingSound])

  // Typing: один общий канал `typing:global:v1` (см. lib/chat/typing-global-channel.js + use-chat-typing).
  useEffect(() => {
    if (!supabase || !userId) return

    let cancelled = false
    const onTypingStart = (payload) => {
      if (cancelled) return
      const convId = String(payload?.conversationId || '')
      const fromUserId = String(payload?.userId || '')
      if (!convId || !fromUserId || fromUserId === String(userIdRef.current || '')) return
      const name = String(payload?.name || '')
      setTypingByConversation((prev) => ({
        ...prev,
        [convId]: {
          name: name || null,
          ts: Date.now(),
        },
      }))
    }
    const onTypingStop = (payload) => {
      if (cancelled) return
      const convId = String(payload?.conversationId || '')
      const fromUserId = String(payload?.userId || '')
      if (!convId || !fromUserId || fromUserId === String(userIdRef.current || '')) return
      setTypingByConversation((prev) => {
        if (!prev[convId]) return prev
        const next = { ...prev }
        delete next[convId]
        return next
      })
    }

    const { release } = retainTypingGlobalChannel(supabase, {
      onTypingStart,
      onTypingStop,
    })

    return () => {
      cancelled = true
      release()
      setTypingByConversation({})
    }
  }, [userId])

  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now()
      setTypingByConversation((prev) => {
        let changed = false
        const next = { ...prev }
        for (const [cid, state] of Object.entries(prev)) {
          if (!state || now - Number(state.ts || 0) > 5000) {
            delete next[cid]
            changed = true
          }
        }
        return changed ? next : prev
      })
    }, 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!userId || !loaded || pathname == null) return
    if (prevPathnameRef.current === null) {
      prevPathnameRef.current = pathname
      return
    }
    if (prevPathnameRef.current === pathname) return
    prevPathnameRef.current = pathname
    const now = Date.now()
    if (now - lastRefreshNavRef.current < 2500) return
    lastRefreshNavRef.current = now
    void refresh()
  }, [pathname, userId, loaded, refresh])

  useEffect(() => {
    if (!userId) return
    const bump = () => {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - lastRefreshVisRef.current < 20000) return
      lastRefreshVisRef.current = now
      void refresh()
    }
    window.addEventListener('focus', bump)
    document.addEventListener('visibilitychange', bump)
    return () => {
      window.removeEventListener('focus', bump)
      document.removeEventListener('visibilitychange', bump)
    }
  }, [userId, refresh])

  useEffect(() => {
    if (!userId) return
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      void refresh()
    }, 30000)
    return () => clearInterval(id)
  }, [userId, refresh])

  const pushRefreshTimerRef = useRef(null)

  useEffect(() => {
    if (!userId) return
    const onPush = (evt) => {
      const d = evt?.detail || {}
      const type = String(d.type || '').toUpperCase()
      const cid = d.conversationId || null

      if (type === 'BADGE_UPDATE' || type === 'NEW_MESSAGE') {
        if (pushRefreshTimerRef.current) clearTimeout(pushRefreshTimerRef.current)
        pushRefreshTimerRef.current = setTimeout(() => {
          pushRefreshTimerRef.current = null
          void refresh()
        }, 450)
      }
      if (type === 'NEW_MESSAGE' && shouldPlayIncomingSound(cid)) {
        playNotificationSound()
      }
    }
    window.addEventListener('gostaylo:push-message', onPush)
    return () => {
      window.removeEventListener('gostaylo:push-message', onPush)
      if (pushRefreshTimerRef.current) {
        clearTimeout(pushRefreshTimerRef.current)
        pushRefreshTimerRef.current = null
      }
    }
  }, [userId, refresh, shouldPlayIncomingSound])

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
      typingByConversation,
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
      typingByConversation,
    ],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChatContext() {
  return useContext(ChatContext) ?? SAFE_DEFAULTS
}
