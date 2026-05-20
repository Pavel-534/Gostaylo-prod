/**
 * Stage 108.2 — SSOT POST /api/v2/chat/messages (текст, voice, system, file).
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
