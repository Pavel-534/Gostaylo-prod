/**
 * Stage 202.22 — browser client for GET /api/v2/referral/me/engagement
 */
import { dedupeClientRequest } from '@/lib/api/client-request-dedup'
import { TTL_AUTH_ME_MS } from '@/lib/api/client-fetch-policy'

const CACHE_KEY = 'referral:engagement'

async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

export async function fetchReferralEngagement() {
  return dedupeClientRequest(CACHE_KEY, async () => {
    const res = await fetch('/api/v2/referral/me/engagement', {
      credentials: 'include',
      cache: 'no-store',
    })
    const json = await readJson(res)
    return {
      ok: res.ok && json.success === true,
      data: json.data ?? null,
      json,
      status: res.status,
    }
  }, TTL_AUTH_ME_MS)
}
