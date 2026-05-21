/**
 * Stage 111.1 / 112.3 / 113.0 — клиент сессии и Realtime JWT.
 */

import {
  dedupeClientRequest,
  invalidateClientRequest,
} from '@/lib/api/client-request-dedup'
import { CACHE_KEY, TTL_AUTH_ME_MS } from '@/lib/api/client-fetch-policy'

const defaultFetch = typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null

async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

async function fetchAuthMeRaw(fetchImpl) {
  const res = await fetchImpl('/api/v2/auth/me', { credentials: 'include', cache: 'no-store' })
  const body = await readJson(res)
  if (!res.ok || !body?.success) {
    return { ok: false, user: null, raw: body, status: res.status }
  }
  return { ok: true, user: body.user ?? null, raw: body, status: res.status }
}

export async function fetchAuthMe(fetchImpl = defaultFetch) {
  if (fetchImpl && fetchImpl !== defaultFetch) {
    return fetchAuthMeRaw(fetchImpl)
  }
  return dedupeClientRequest(CACHE_KEY.authMe, () => fetchAuthMeRaw(defaultFetch), {
    ttlMs: TTL_AUTH_ME_MS,
  })
}

/** Сброс кэша me (logout / явная смена сессии). */
export function invalidateAuthMeCache() {
  invalidateClientRequest(CACHE_KEY.authMe)
}

export async function fetchRealtimeToken(fetchImpl = defaultFetch) {
  return dedupeClientRequest(
    'auth:realtime-token',
    async () => {
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
    },
    { ttlMs: 0 },
  )
}

export async function fetchRealtimeClaims(fetchImpl = defaultFetch) {
  return dedupeClientRequest(
    'auth:realtime-claims',
    async () => {
      const res = await fetchImpl('/api/v2/auth/realtime-claims', {
        credentials: 'include',
        cache: 'no-store',
      })
      const json = await readJson(res)
      return { ok: res.ok && json?.ok === true, json, status: res.status }
    },
    { ttlMs: 0 },
  )
}
