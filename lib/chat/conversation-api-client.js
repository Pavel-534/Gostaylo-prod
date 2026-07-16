/**
 * Stage 110.8 / 113.0 — SSOT клиентских вызовов Chat API (инбокс, ChatContext, избранное).
 */

import {
  dedupeClientRequest,
  invalidateClientRequest,
  invalidateClientRequestPrefix,
} from '@/lib/api/client-request-dedup'
import {
  CACHE_KEY,
  TTL_CHAT_CONVERSATIONS_INFLIGHT_MS,
  TTL_CHAT_FAVORITES_MS,
  TTL_CHAT_PROVIDER_LIST_MS,
  TTL_CHAT_UNREAD_COUNT_MS,
} from '@/lib/api/client-fetch-policy'

function invalidateChatListCaches() {
  invalidateClientRequest(CACHE_KEY.chatProviderList)
  invalidateClientRequest(CACHE_KEY.chatUnreadCount)
  invalidateClientRequestPrefix('chat:conversations:')
}

/**
 * @param {URLSearchParams | Record<string, string>} query
 */
export async function fetchConversationsList(query) {
  const params =
    query instanceof URLSearchParams ? query : new URLSearchParams(query)
  const cacheKey = `chat:conversations:${params.toString()}`
  return dedupeClientRequest(
    cacheKey,
    async () => {
      try {
        const res = await fetch(`/api/v2/chat/conversations?${params}`, {
          credentials: 'include',
          cache: 'no-store',
        })
        const json = await res.json().catch(() => ({}))
        return {
          ok: res.ok && json.success === true,
          data: Array.isArray(json.data) ? json.data : [],
          meta: json.meta ?? null,
          error: json.error ?? null,
        }
      } catch (e) {
        return { ok: false, data: [], meta: null, error: e?.message || 'network' }
      }
    },
    { ttlMs: TTL_CHAT_CONVERSATIONS_INFLIGHT_MS },
  )
}

/** Список для ChatProvider (бейдж / getConversationForListing). */
export async function fetchChatProviderConversations({ bustCache = false } = {}) {
  if (bustCache) invalidateClientRequest(CACHE_KEY.chatProviderList)
  return dedupeClientRequest(
    CACHE_KEY.chatProviderList,
    () =>
      fetchConversationsList({
        archived: 'all',
        enrich: '1',
        limit: '100',
      }),
    { ttlMs: TTL_CHAT_PROVIDER_LIST_MS },
  )
}

/** Lightweight nav badge — GET /api/v2/chat/unread-count (Stage 171.29). */
export async function fetchChatUnreadCount({ bustCache = false } = {}) {
  if (bustCache) invalidateClientRequest(CACHE_KEY.chatUnreadCount)
  return dedupeClientRequest(
    CACHE_KEY.chatUnreadCount,
    async () => {
      try {
        const res = await fetch('/api/v2/chat/unread-count', {
          credentials: 'include',
          cache: 'no-store',
        })
        const json = await res.json().catch(() => ({}))
        return {
          ok: res.ok && json.success === true,
          count: Math.max(0, Number(json.count) || 0),
          lastUpdated: json.lastUpdated ?? null,
          error: json.error ?? null,
        }
      } catch (e) {
        return {
          ok: false,
          count: 0,
          lastUpdated: null,
          error: e?.message || 'network',
        }
      }
    },
    { ttlMs: TTL_CHAT_UNREAD_COUNT_MS },
  )
}

export async function fetchChatFavoriteIds() {
  return dedupeClientRequest(
    CACHE_KEY.chatFavorites,
    async () => {
      try {
        const res = await fetch('/api/v2/chat/favorites', { credentials: 'include', cache: 'no-store' })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json.success || !Array.isArray(json.data)) {
          return { ok: false, ids: [] }
        }
        return { ok: true, ids: json.data.map(String) }
      } catch {
        return { ok: false, ids: [] }
      }
    },
    { ttlMs: TTL_CHAT_FAVORITES_MS },
  )
}

export async function bulkMigrateChatFavorites(conversationIds) {
  const res = await fetch('/api/v2/chat/favorites/bulk', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationIds }),
  })
  const json = await res.json().catch(() => ({}))
  const out = { ok: res.ok && json.success === true, json }
  if (out.ok) invalidateChatListCaches()
  return out
}

export async function toggleChatFavorite(conversationId, isFavorite) {
  const res = await fetch('/api/v2/chat/favorites/toggle', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, isFavorite }),
  })
  const json = await res.json().catch(() => ({}))
  const out = { ok: res.ok && json.success === true, json }
  if (out.ok) {
    invalidateClientRequest(CACHE_KEY.chatFavorites)
    invalidateChatListCaches()
  }
  return out
}

/**
 * Archive / restore conversation for current user (SSOT for messages hall UI).
 * @param {string} convId
 * @param {boolean} archived
 */
export async function setConversationArchivedClient(convId, archived) {
  if (!convId) return { ok: false, error: 'missing_id' }
  try {
    const res = await fetch('/api/v2/chat/conversations/archive', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: convId, archived: !!archived }),
    })
    const json = await res.json().catch(() => ({}))
    const out = {
      ok: res.ok && json.success === true,
      error: json.error ?? null,
    }
    if (out.ok) invalidateChatListCaches()
    return out
  } catch (e) {
    return { ok: false, error: e?.message || 'network' }
  }
}

/** @param {string} convId */
export async function unarchiveConversationClient(convId) {
  if (!convId) return
  const { ok } = await setConversationArchivedClient(convId, false)
  if (!ok) {
    /* fire-and-forget — inbox may refresh on next load */
  }
}

/**
 * @param {string} convId
 * @returns {Promise<object|null>}
 */
export async function postChatConversationFromProfile({ targetUserId, language }) {
  try {
    const res = await fetch('/api/v2/chat/conversations/from-profile', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId, language }),
    })
    const json = await res.json().catch(() => ({}))
    return {
      ok: res.ok && json.success === true,
      conversationId: json.data?.id ?? null,
      error: json.error ?? null,
      errorKey: json.errorKey ?? null,
      json,
      status: res.status,
    }
  } catch (e) {
    return {
      ok: false,
      conversationId: null,
      error: e?.message || 'network',
      errorKey: null,
      json: {},
      status: 0,
    }
  }
}

export async function fetchEnrichedConversation(convId) {
  if (!convId) return null
  try {
    const res = await fetch(
      `/api/v2/chat/conversations?id=${encodeURIComponent(convId)}&enrich=1`,
      { credentials: 'include', cache: 'no-store' },
    )
    if (!res.ok) return null
    const data = await res.json()
    return data?.data?.[0] ?? null
  } catch {
    return null
  }
}

const convSortTs = (c) =>
  new Date(
    c.lastMessageAt || c.last_message_at || c.updatedAt || c.updated_at || c.createdAt || 0,
  ).getTime()

/**
 * Вставка/обновление строки в списке инбокса после fetch одной беседы.
 * @param {Function} setConversations
 * @param {object} conv
 */
export function mergeFetchedConversationIntoList(setConversations, conv) {
  if (!conv?.id) return
  setConversations((prev) => {
    const key = String(conv.id)
    const idx = prev.findIndex((c) => String(c.id) === key)
    if (idx === -1) return [conv, ...prev]
    const next = [...prev]
    next[idx] = { ...next[idx], ...conv }
    const row = next[idx]
    next.splice(idx, 1)
    return [row, ...next].sort((a, b) => convSortTs(b) - convSortTs(a))
  })
}
