/**
 * Stage 112.0 — клиент Chat API для UI (перевод, шаблоны, админ-поддержка).
 * SSOT рядом с conversation-api-client (инбокс).
 */

async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

export async function translateChatMessage({ text, target }) {
  const res = await fetch('/api/v2/translate', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, target }),
  })
  const json = await readJson(res)
  return {
    ok: res.ok && json.success,
    translatedText: json.data?.translatedText ?? null,
    error: json.error ?? null,
    status: res.status,
  }
}

export async function fetchChatMessages(conversationId) {
  const res = await fetch(
    `/api/v2/chat/messages?conversationId=${encodeURIComponent(conversationId)}`,
    { credentials: 'include', cache: 'no-store' },
  )
  const json = await readJson(res)
  return {
    ok: res.ok && json.success,
    data: json.data ?? [],
    error: json.error ?? null,
    status: res.status,
  }
}

export async function fetchAdminEnrichedConversations() {
  const res = await fetch('/api/v2/chat/conversations?enrich=1', {
    credentials: 'include',
    cache: 'no-store',
  })
  const json = await readJson(res)
  return {
    ok: res.ok && json.success,
    data: Array.isArray(json.data) ? json.data : [],
    status: res.status,
  }
}

export async function postChatSupportJoin({ conversationId, lang } = {}) {
  const res = await fetch('/api/v2/chat/support/join', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversationId,
      ...(lang ? { lang } : {}),
    }),
  })
  const json = await readJson(res)
  return { ok: res.ok && json.success, json, status: res.status }
}

export async function fetchChatTemplates() {
  const res = await fetch('/api/v2/chat/templates', { credentials: 'include' })
  const json = await readJson(res)
  return {
    ok: res.ok && json.success,
    templates: Array.isArray(json.data) ? json.data : [],
    status: res.status,
  }
}

export async function saveChatTemplate(body) {
  const res = await fetch('/api/v2/chat/templates', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await readJson(res)
  return { ok: res.ok && json.success, json, status: res.status }
}

export async function deleteChatTemplate(id) {
  const res = await fetch(`/api/v2/chat/templates?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  const json = await readJson(res)
  return { ok: res.ok && json.success, json, status: res.status }
}

export async function postChatMarkRead(conversationId) {
  const res = await fetch('/api/v2/chat/read', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId }),
  })
  const json = await readJson(res)
  return { ok: res.ok && json.success, json, status: res.status }
}

export async function postChatEscalate(body) {
  const res = await fetch('/api/v2/chat/escalate', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await readJson(res)
  return { ok: res.ok && json.success, json, status: res.status }
}
