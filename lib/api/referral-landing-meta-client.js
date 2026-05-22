/**
 * Stage 114.5 — dedup + TTL для GET /api/v2/referral/landing-meta/[userId].
 */
import { dedupeClientRequest, invalidateClientRequest } from '@/lib/api/client-request-dedup'

const TTL_LANDING_META_MS = 60_000

function cacheKey(userId) {
  return `referral:landing-meta:${String(userId || '').trim()}`
}

async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

export async function fetchReferralLandingMeta(userId, { bustCache = false } = {}) {
  const id = String(userId || '').trim()
  if (!id) return { ok: false, data: null, json: { error: 'INVALID_ID' }, status: 400 }
  const key = cacheKey(id)
  if (bustCache) invalidateClientRequest(key)
  return dedupeClientRequest(
    key,
    async () => {
      const res = await fetch(`/api/v2/referral/landing-meta/${encodeURIComponent(id)}`, {
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
    { ttlMs: TTL_LANDING_META_MS },
  )
}
