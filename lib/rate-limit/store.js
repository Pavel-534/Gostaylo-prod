/**
 * Stage 168.2 — rate limit store facade.
 *
 * Priority: Vercel KV → Upstash Redis → in-memory (per-instance fallback).
 */

import { checkMemoryRateLimit } from '@/lib/rate-limit/memory-store'
import {
  checkRemoteRateLimit,
  isRemoteRateLimitConfigured,
  resolveRemoteStoreConfig,
} from '@/lib/rate-limit/redis-store'

let warnedMemoryFallback = false

function warnMemoryFallbackOnce() {
  if (warnedMemoryFallback) return
  warnedMemoryFallback = true
  const msg =
    '[rate-limit] No remote store configured (KV_REST_API_URL + KV_REST_API_TOKEN, or UPSTASH_REDIS_REST_*) — using in-memory fallback; limits are per-instance only'
  if (process.env.NODE_ENV === 'production') {
    console.warn(msg)
  } else {
    console.info(msg)
  }
}

/**
 * @param {string} key
 * @param {{ windowMs: number, max: number }} config
 * @returns {Promise<{ allowed: boolean, remaining: number, limit: number, retryAfter?: number, backend: 'kv' | 'redis' | 'memory' }>}
 */
export async function consumeRateLimit(key, config) {
  if (isRemoteRateLimitConfigured()) {
    try {
      return await checkRemoteRateLimit(key, config)
    } catch (e) {
      const kind = resolveRemoteStoreConfig()?.kind ?? 'remote'
      console.warn(
        `[rate-limit] ${kind} error, falling back to memory:`,
        e?.message || e,
      )
    }
  } else {
    warnMemoryFallbackOnce()
  }

  const result = checkMemoryRateLimit(key, config)
  return { ...result, backend: 'memory' }
}

export { isRemoteRateLimitConfigured, isRemoteRateLimitConfigured as isRedisRateLimitConfigured }
