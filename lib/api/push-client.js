/**
 * Stage 112.3 — FCM token register/ping (push-client-init).
 */

async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

export async function postPushAction(body) {
  const res = await fetch('/api/v2/push', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await readJson(res)
  return { ok: res.ok && json.success !== false, json, status: res.status }
}
