/**
 * Stage 111.1 / 112.3 — клиент сессии и Realtime JWT.
 */

const defaultFetch = typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null

async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

export async function fetchAuthMe(fetchImpl = defaultFetch) {
  const res = await fetchImpl('/api/v2/auth/me', { credentials: 'include' })
  const body = await readJson(res)
  if (!res.ok || !body?.success) {
    return { ok: false, user: null, raw: body, status: res.status }
  }
  return { ok: true, user: body.user ?? null, raw: body, status: res.status }
}

export async function fetchRealtimeToken(fetchImpl = defaultFetch) {
  const res = await fetchImpl('/api/v2/auth/realtime-token', {
    credentials: 'include',
    cache: 'no-store',
  })
  const json = await readJson(res)
  return {
    ok: res.ok && Boolean(json?.access_token),
    accessToken: json?.access_token ?? null,
    json,
    status: res.status,
  }
}

export async function fetchRealtimeClaims(fetchImpl = defaultFetch) {
  const res = await fetchImpl('/api/v2/auth/realtime-claims', { credentials: 'include' })
  const json = await readJson(res)
  return { ok: res.ok && json?.ok === true, json, status: res.status }
}
