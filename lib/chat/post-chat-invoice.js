/**
 * Stage 110.6 — клиентский SSOT POST /api/v2/chat/invoice.
 * Сервер: hold/commission → `executePostChatMessageForUser` в post-chat-message.server.js.
 */

/**
 * @param {object} body — conversationId, amount, currency, …
 */
export async function postChatInvoice(body) {
  const res = await fetch('/api/v2/chat/invoice', {
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
    data: json.message ?? null,
    invoice: json.invoice ?? null,
    error: json.error || (res.ok ? null : `HTTP ${res.status}`),
  }
}

/** POST /api/v2/chat/invoice/cancel */
export async function cancelChatInvoice(messageId) {
  const res = await fetch('/api/v2/chat/invoice/cancel', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messageId }),
  })
  const json = await res.json().catch(() => ({}))
  return {
    ok: res.ok && json.success === true,
    error: json.error || (res.ok ? null : `HTTP ${res.status}`),
  }
}
