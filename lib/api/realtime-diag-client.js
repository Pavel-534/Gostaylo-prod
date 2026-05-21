/**
 * Stage 112.3 — Realtime diagnostic API (admin overlay).
 */

async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

export async function fetchRealtimeDiag() {
  const res = await fetch('/api/v2/realtime-diag', { credentials: 'include' })
  const json = await readJson(res)
  return { ok: res.ok, json, status: res.status }
}
