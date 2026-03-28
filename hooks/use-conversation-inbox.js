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
