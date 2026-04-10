'use client'

/**
 * @file hooks/use-conversation-inbox.js
 *
 * Инбокс: пагинация, Realtime, вкладки Hosting/Traveling, избранное (API + optimistic UI).
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import {
  INBOX_TAB_HOSTING,
  INBOX_TAB_TRAVELING,
  filterConversationsByInboxTab,
  sumUnreadInConversations,
} from '@/lib/chat-inbox-tabs'
import { useRealtimeConversations } from '@/hooks/use-realtime-chat'
import {
  dispatchInboxFavoritesChanged,
  readLegacyFavoriteIds,
  isFavoritesMigrated,
  setFavoritesMigrated,
} from '@/lib/chat-inbox-favorites'
import { supabase } from '@/lib/supabase'
import { subscribeRealtimeWithBackoff } from '@/lib/chat/realtime-subscribe-with-backoff'

/** lastMessage для превью в списке (как в ChatContext). */
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

function debounce(fn, ms) {
  let timer = null
  const debounced = (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
  debounced.cancel = () => clearTimeout(timer)
  return debounced
}

const PAGE_SIZE = 20
const TOGGLE_DEBOUNCE_MS = 320

export function useConversationInbox({
  userId,
  defaultTab = INBOX_TAB_TRAVELING,
  enabled = true,
  /** true = только скрытые у пользователя диалоги (GET …&archived=only) */
  archivedOnly = false,
}) {
  const [conversations, setConversations] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [offset, setOffset] = useState(0)

  const [inboxTab, setInboxTab] = useState(defaultTab)

  const [favoriteIds, setFavoriteIds] = useState([])
  const [favoriteTogglePendingIds, setFavoriteTogglePendingIds] = useState([])

  const favoriteOnlyFetchRef = useRef(false)
  const archivedOnlyRef = useRef(archivedOnly)
  const [, bumpFavoriteOnlyVersion] = useState(0)
  const debouncedLoadRef = useRef(null)
  const toggleTimersRef = useRef(new Map())

  const favoriteIdSet = useMemo(() => new Set(favoriteIds.map(String)), [favoriteIds])
  const favoriteIdsRef = useRef(favoriteIds)
  useEffect(() => {
    favoriteIdsRef.current = favoriteIds
  }, [favoriteIds])

  const userIdRef = useRef(userId)
  useEffect(() => {
    userIdRef.current = userId
  }, [userId])

  const msgUnknownConvFetchRef = useRef(new Set())

  useEffect(() => {
    archivedOnlyRef.current = archivedOnly
  }, [archivedOnly])

  const setFavoriteOnlyFetch = useCallback((value) => {
    const v = !!value
    if (favoriteOnlyFetchRef.current === v) return
    favoriteOnlyFetchRef.current = v
    bumpFavoriteOnlyVersion((n) => n + 1)
    debouncedLoadRef.current?.({ offset: 0, append: false })
  }, [])

  const _fetchConversations = useCallback(
    async ({ offset: fetchOffset = 0, append = false } = {}) => {
      if (!userId || !enabled) return

      if (append) {
        setIsLoadingMore(true)
      } else {
        setIsLoading(true)
      }

      try {
        const params = new URLSearchParams({
          enrich: '1',
          limit: String(PAGE_SIZE),
          offset: String(fetchOffset),
        })
        if (favoriteOnlyFetchRef.current) {
          params.set('is_favorite', 'true')
        }
        if (archivedOnlyRef.current) {
          params.set('archived', 'only')
        }

        const res = await fetch(`/api/v2/chat/conversations?${params}`, {
          credentials: 'include',
        })
        const json = await res.json()

        if (!res.ok || !json.success) return

        const rows = Array.isArray(json.data) ? json.data : []

        if (append) {
          setConversations((prev) => {
            const existingIds = new Set(prev.map((c) => c.id))
            const fresh = rows.filter((c) => !existingIds.has(c.id))
            return [...prev, ...fresh]
          })
          setOffset(fetchOffset)
        } else {
          setConversations(rows)
          setOffset(0)
        }

        setHasMore(!!json.meta?.hasMore)
      } catch (err) {
        console.error('[useConversationInbox] fetchConversations error:', err)
      } finally {
        if (append) {
          setIsLoadingMore(false)
        } else {
          setIsLoading(false)
        }
      }
    },
    [userId, enabled]
  )

  useEffect(() => {
    const debounced = debounce((opts) => _fetchConversations(opts), 300)
    debouncedLoadRef.current = debounced
    return () => debounced.cancel()
  }, [_fetchConversations])

  useEffect(() => {
    if (!userId || !enabled) return
    debouncedLoadRef.current?.({ offset: 0, append: false })
  }, [userId, enabled, archivedOnly])

  const refreshFavoriteIdsFromServer = useCallback(async () => {
    if (!userId) return
    try {
      const res = await fetch('/api/v2/chat/favorites', { credentials: 'include' })
      const json = await res.json()
      if (!res.ok || !json.success || !Array.isArray(json.data)) return
      setFavoriteIds(json.data.map(String))
    } catch (e) {
      console.error('[useConversationInbox] refreshFavoriteIds', e)
    }
  }, [userId])

  const runLegacyMigrationIfNeeded = useCallback(async () => {
    if (typeof window === 'undefined' || !userId) return
    if (isFavoritesMigrated()) return
    const legacy = readLegacyFavoriteIds()
    if (!legacy.length) {
      setFavoritesMigrated()
      return
    }
    try {
      const res = await fetch('/api/v2/chat/favorites/bulk', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationIds: legacy }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        console.warn('[useConversationInbox] bulk migrate favorites', json)
        return
      }
      setFavoritesMigrated()
    } catch (e) {
      console.error('[useConversationInbox] bulk migrate', e)
    }
  }, [userId])

  useEffect(() => {
    if (!userId || !enabled) {
      setFavoriteIds([])
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/v2/chat/favorites', { credentials: 'include' })
        const json = await res.json()
        if (cancelled) return
        if (!res.ok || !json.success || !Array.isArray(json.data)) return
        let ids = json.data.map(String)
        if (ids.length === 0) {
          await runLegacyMigrationIfNeeded()
          if (cancelled) return
          const res2 = await fetch('/api/v2/chat/favorites', { credentials: 'include' })
          const j2 = await res2.json()
          if (cancelled) return
          if (res2.ok && j2.success && Array.isArray(j2.data)) {
            ids = j2.data.map(String)
          }
        } else if (!isFavoritesMigrated()) {
          setFavoritesMigrated()
        }
        if (!cancelled) setFavoriteIds(ids)
      } catch (e) {
        console.error('[useConversationInbox] init favorites', e)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userId, enabled, runLegacyMigrationIfNeeded])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && userId && enabled) {
        void refreshFavoriteIdsFromServer()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [userId, enabled, refreshFavoriteIdsFromServer])

  useEffect(() => {
    return () => {
      for (const t of toggleTimersRef.current.values()) {
        clearTimeout(t)
      }
      toggleTimersRef.current.clear()
    }
  }, [])

  const toggleFavorite = useCallback(
    (conversationId) => {
      if (!conversationId || !userId) return
      const id = String(conversationId)

      setFavoriteIds((prev) => {
        const s = new Set(prev.map(String))
        const was = s.has(id)
        if (!was) s.add(id)
        else s.delete(id)
        return [...s]
      })

      const prevTimer = toggleTimersRef.current.get(id)
      if (prevTimer) clearTimeout(prevTimer)

      const t = setTimeout(async () => {
        toggleTimersRef.current.delete(id)
        setFavoriteTogglePendingIds((p) => (p.includes(id) ? p : [...p, id]))

        const shouldBeFavorite = new Set(favoriteIdsRef.current.map(String)).has(id)

        try {
          const res = await fetch('/api/v2/chat/favorites/toggle', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversationId: id, isFavorite: shouldBeFavorite }),
          })
          const json = await res.json()

          if (!res.ok || !json.success) {
            await refreshFavoriteIdsFromServer()
            dispatchInboxFavoritesChanged()
            toast.error(json?.error || 'Не удалось обновить избранное')
            return
          }

          if (favoriteOnlyFetchRef.current && !shouldBeFavorite) {
            setConversations((prev) => prev.filter((c) => String(c.id) !== id))
          }

          dispatchInboxFavoritesChanged()
        } catch (e) {
          await refreshFavoriteIdsFromServer()
          dispatchInboxFavoritesChanged()
          toast.error('Ошибка сети при обновлении избранного')
          console.error('[useConversationInbox] toggleFavorite', e)
        } finally {
          setFavoriteTogglePendingIds((p) => p.filter((x) => x !== id))
        }
      }, TOGGLE_DEBOUNCE_MS)

      toggleTimersRef.current.set(id, t)
    },
    [userId, refreshFavoriteIdsFromServer]
  )

  const unarchiveConversation = useCallback(async (convId) => {
    try {
      await fetch('/api/v2/chat/conversations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId, archived: false }),
      })
    } catch {
      /* ignore */
    }
  }, [])

  const fetchOneConversationForInbox = useCallback(async (convId) => {
    if (!convId) return
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
        if (prev.some((c) => String(c.id) === String(conv.id))) {
          const idx = prev.findIndex((c) => String(c.id) === String(conv.id))
          if (idx === -1) return prev
          const next = [...prev]
          next[idx] = { ...next[idx], ...conv }
          const row = next[idx]
          const ts = (c) =>
            new Date(
              c.lastMessageAt || c.last_message_at || c.updatedAt || c.updated_at || c.createdAt || 0,
            ).getTime()
          next.splice(idx, 1)
          return [row, ...next].sort((a, b) => ts(b) - ts(a))
        }
        return [conv, ...prev]
      })
    } catch {
      /* ignore */
    }
  }, [])

  const handleRealtimeConvUpdate = useCallback(
    (payload) => {
      if (!payload?.new) {
        debouncedLoadRef.current?.({ offset: 0, append: false })
        return
      }

      const incoming = payload.new
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === incoming.id)
        if (payload.eventType === 'DELETE') {
          return prev.filter((c) => c.id !== payload.old?.id)
        }
        if (idx !== -1) {
          const next = [...prev]
          const updatedConv = {
            ...next[idx],
            statusLabel: incoming.status_label ?? incoming.statusLabel ?? next[idx].statusLabel,
            lastMessageAt: incoming.last_message_at ?? next[idx].lastMessageAt,
            updatedAt: incoming.updated_at ?? next[idx].updatedAt,
            isPriority: incoming.is_priority ?? next[idx].isPriority,
          }
          next[idx] = updatedConv
          if (payload.eventType === 'UPDATE' && incoming.last_message_at) {
            next.splice(idx, 1)
            return [updatedConv, ...next].sort((a, b) => {
              const ta = new Date(a.lastMessageAt || a.updatedAt || 0).getTime()
              const tb = new Date(b.lastMessageAt || b.updatedAt || 0).getTime()
              return tb - ta
            })
          }
          return next
        }
        _fetchConversations({ offset: 0, append: false }).catch(() => {})
        return prev
      })
    },
    [_fetchConversations]
  )

  useRealtimeConversations(userId ?? null, handleRealtimeConvUpdate)

  // INSERT в messages: обновляем превью + unread + порядок (холл не использует ChatContext).
  useEffect(() => {
    if (!userId || !enabled || !supabase) return

    const stop = subscribeRealtimeWithBackoff({
      supabase,
      channelLabel: `inbox:messages:${userId}`,
      createChannel: (attempt) =>
        supabase
          .channel(`inbox-messages:${userId}:${attempt}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages' },
            (payload) => {
              const msg = payload.new
              const convId = msg?.conversation_id
              const uid = userIdRef.current
              if (!convId || !uid) return
              const convKey = String(convId)

              let missingInList = false
              setConversations((prev) => {
                const idx = prev.findIndex((c) => String(c.id) === convKey)
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
                  unreadCount: isFromMe
                    ? Number(conv.unreadCount) || 0
                    : (Number(conv.unreadCount) || 0) + 1,
                  renterArchivedAt: !isFromMe && iAmRenter ? null : conv.renterArchivedAt,
                  partnerArchivedAt: !isFromMe && iAmPartner ? null : conv.partnerArchivedAt,
                }

                if (wasArchivedByMe) {
                  void unarchiveConversation(convKey)
                }

                const next = prev.filter((c) => String(c.id) !== convKey)
                return [updated, ...next]
              })

              if (missingInList && !msgUnknownConvFetchRef.current.has(convKey)) {
                msgUnknownConvFetchRef.current.add(convKey)
                void fetchOneConversationForInbox(convKey).finally(() => {
                  msgUnknownConvFetchRef.current.delete(convKey)
                })
              }
            },
          ),
    })

    return () => stop()
  }, [userId, enabled, unarchiveConversation, fetchOneConversationForInbox])

  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMore) return
    const nextOffset = offset + PAGE_SIZE
    _fetchConversations({ offset: nextOffset, append: true })
  }, [hasMore, isLoadingMore, offset, _fetchConversations])

  const refresh = useCallback(() => {
    _fetchConversations({ offset: 0, append: false })
  }, [_fetchConversations])

  const filteredConversations = useMemo(() => {
    const tab = filterConversationsByInboxTab(conversations, userId, inboxTab)
    const ts = (c) =>
      new Date(
        c.lastMessageAt || c.last_message_at || c.updatedAt || c.updated_at || c.createdAt || 0
      ).getTime()
    return [...tab].sort((a, b) => {
      const tb = ts(b)
      const ta = ts(a)
      if (tb !== ta) return tb - ta
      const ba = a.bookingId || a.booking_id ? 1 : 0
      const bb = b.bookingId || b.booking_id ? 1 : 0
      if (bb !== ba) return bb - ba
      return String(b.id || '').localeCompare(String(a.id || ''))
    })
  }, [conversations, userId, inboxTab])

  const hostingUnread = useMemo(
    () =>
      sumUnreadInConversations(
        filterConversationsByInboxTab(conversations, userId, INBOX_TAB_HOSTING)
      ),
    [conversations, userId]
  )

  const travelingUnread = useMemo(
    () =>
      sumUnreadInConversations(
        filterConversationsByInboxTab(conversations, userId, INBOX_TAB_TRAVELING)
      ),
    [conversations, userId]
  )

  const totalUnread = useMemo(
    () => hostingUnread + travelingUnread,
    [hostingUnread, travelingUnread]
  )

  return {
    conversations,
    filteredConversations,
    isLoading,
    hasMore,
    isLoadingMore,

    inboxTab,
    setInboxTab,

    hostingUnread,
    travelingUnread,
    totalUnread,

    loadMore,
    refresh,
    setConversations,

    favoriteIdSet,
    favoriteTogglePendingIds,
    toggleFavorite,
    setFavoriteOnlyFetch,
    refreshFavoriteIdsFromServer,
  }
}
