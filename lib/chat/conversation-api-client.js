/**
 * Stage 110.8 — SSOT клиентских вызовов Chat API (инбокс, ChatContext, избранное).
 */

/**
 * @param {URLSearchParams | Record<string, string>} query
 */
export async function fetchConversationsList(query) {
  const params =
    query instanceof URLSearchParams ? query : new URLSearchParams(query)
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
}

/** Список для ChatProvider (бейдж / getConversationForListing). */
export async function fetchChatProviderConversations() {
  return fetchConversationsList({
    archived: 'all',
    enrich: '1',
    limit: '100',
  })
}

export async function fetchChatFavoriteIds() {
  try {
    const res = await fetch('/api/v2/chat/favorites', { credentials: 'include' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.success || !Array.isArray(json.data)) {
      return { ok: false, ids: [] }
    }
    return { ok: true, ids: json.data.map(String) }
  } catch {
    return { ok: false, ids: [] }
  }
}

export async function bulkMigrateChatFavorites(conversationIds) {
  const res = await fetch('/api/v2/chat/favorites/bulk', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationIds }),
  })
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok && json.success === true, json }
}

export async function toggleChatFavorite(conversationId, isFavorite) {
  const res = await fetch('/api/v2/chat/favorites/toggle', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, isFavorite }),
  })
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok && json.success === true, json }
}

/**
 * @param {string} convId
 */
export async function unarchiveConversationClient(convId) {
  if (!convId) return
  try {
    await fetch('/api/v2/chat/conversations', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: convId, archived: false }),
    })
  } catch {
    /* fire-and-forget */
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
