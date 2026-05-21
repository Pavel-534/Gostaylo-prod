/**
 * Stage 110.6 — клиентский SSOT POST /api/v2/chat/messages.
 * Сервер: `lib/chat/post-chat-message.server.js`. Счёт в чате: `lib/chat/post-chat-invoice.js`.
 */

/**
 * @param {object} body — conversationId, type, content, metadata, …
 */
export async function postChatMessage(body) {
  const res = await fetch('/api/v2/chat/messages', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  let json = {}
  try {
    json = await res.json()
  } catch {
    json = {}
  }
  return {
    ok: res.ok && json.success === true,
    status: res.status,
    data: json.data ?? null,
    error: json.error || (res.ok ? null : `HTTP ${res.status}`),
  }
}
