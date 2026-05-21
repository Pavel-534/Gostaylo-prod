/**
 * Stage 114.1 — SSOT browser client for GET /api/v2/referral/me (dedup + short TTL).
 */

import { dedupeClientRequest, invalidateClientRequest } from '@/lib/api/client-request-dedup'
import { TTL_AUTH_ME_MS } from '@/lib/api/client-fetch-policy'

const CACHE_KEY_REFERRAL_ME = 'referral:me'

async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

export async function fetchReferralMe({ bustCache = false } = {}) {
  if (bustCache) {
    invalidateClientRequest(CACHE_KEY_REFERRAL_ME)
  }
  return dedupeClientRequest(
    CACHE_KEY_REFERRAL_ME,
    async () => {
      const res = await fetch('/api/v2/referral/me', {
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
    },
    { ttlMs: TTL_AUTH_ME_MS },
  )
}

export function invalidateReferralMeCache() {
  invalidateClientRequest(CACHE_KEY_REFERRAL_ME)
}
