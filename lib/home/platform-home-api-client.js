/**
 * Stage 111.1 — клиент API главной страницы (поиск, счётчик, waiting-list).
 */

import { LISTINGS_SEARCH_API_PATH } from '@/lib/search-endpoints'

async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

export async function fetchHomeFeaturedSearch(params) {
  const res = await fetch(`/api/v2/search?${params.toString()}`)
  const data = await readJson(res)
  return {
    ok: res.ok && data.success,
    listings: data?.data?.listings ?? [],
    available: data?.data?.meta?.available ?? 0,
    raw: data,
    status: res.status,
  }
}

export async function fetchHomeListingsAvailableCount(params) {
  const res = await fetch(`${LISTINGS_SEARCH_API_PATH}?${params.toString()}`)
  const data = await readJson(res)
  return {
    ok: res.ok && data.success,
    available: data?.data?.meta?.available ?? 0,
    raw: data,
    status: res.status,
  }
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
