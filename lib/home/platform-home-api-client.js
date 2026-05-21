/**
 * Stage 111.1 / 113.0 — клиент API главной страницы (поиск, счётчик, waiting-list).
 */

import { dedupeClientRequest } from '@/lib/api/client-request-dedup'
import { TTL_HOME_SEARCH_INFLIGHT_MS } from '@/lib/api/client-fetch-policy'
import { LISTINGS_SEARCH_API_PATH } from '@/lib/search-endpoints'

async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

export async function fetchHomeFeaturedSearch(params) {
  const qs = params instanceof URLSearchParams ? params.toString() : new URLSearchParams(params).toString()
  return dedupeClientRequest(
    `home:search:featured:${qs}`,
    async () => {
      const res = await fetch(`/api/v2/search?${qs}`, { cache: 'no-store' })
      const data = await readJson(res)
      return {
        ok: res.ok && data.success,
        listings: data?.data?.listings ?? [],
        available: data?.data?.meta?.available ?? 0,
        raw: data,
        status: res.status,
      }
    },
    { ttlMs: TTL_HOME_SEARCH_INFLIGHT_MS },
  )
}

export async function fetchHomeListingsAvailableCount(params) {
  const qs = params instanceof URLSearchParams ? params.toString() : new URLSearchParams(params).toString()
  return dedupeClientRequest(
    `home:search:count:${qs}`,
    async () => {
      const res = await fetch(`${LISTINGS_SEARCH_API_PATH}?${qs}`, { cache: 'no-store' })
      const data = await readJson(res)
      return {
        ok: res.ok && data.success,
        available: data?.data?.meta?.available ?? 0,
        raw: data,
        status: res.status,
      }
    },
    { ttlMs: TTL_HOME_SEARCH_INFLIGHT_MS },
  )
}

export async function submitHomeWaitingListLead(payload) {
  const res = await fetch('/api/v2/leads/waiting-list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await readJson(res)
  return { ok: res.ok && data?.success, data, status: res.status }
}
