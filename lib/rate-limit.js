/**
 * Stage 168.2 — distributed rate limiting (Vercel KV → Upstash Redis → in-memory fallback).
 */

import { RATE_LIMITS } from '@/lib/rate-limit/config'
import { consumeRateLimit } from '@/lib/rate-limit/store'

export { RATE_LIMITS }

function getClientKey(request) {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  return forwarded?.split(',')[0]?.trim() || realIp || 'unknown'
}

/**
 * @param {Request} request
 * @param {string} [type]
 * @param {string | null} [extraIdentity]
 */
export async function checkRateLimit(request, type = 'default', extraIdentity = null) {
  const config = RATE_LIMITS[type] || RATE_LIMITS.default
  const ip = getClientKey(request)
  const suffix =
    extraIdentity != null && String(extraIdentity).trim() !== ''
      ? `${String(extraIdentity).trim()}:${ip}`
      : ip
  const key = `${type}:${suffix}`
  return consumeRateLimit(key, config)
}

/**
 * Returns { limited: true, status: 429, body, headers } if rate limited, null otherwise.
 * @param {Request} request
 * @param {string} [type]
 * @param {string | null} [extraIdentity]
 */
export async function rateLimitCheck(request, type = 'default', extraIdentity = null) {
  const result = await checkRateLimit(request, type, extraIdentity)
  if (!result.allowed) {
    const isAuth = type === 'auth'
    return {
      limited: true,
      status: 429,
      body: {
        success: false,
        error_code: isAuth ? 'AUTH_RATE_LIMITED' : 'RATE_LIMIT_EXCEEDED',
        ...(isAuth ? {} : { error: 'Too many requests. Please try again later.' }),
        retryAfter: result.retryAfter,
      },
      headers: {
        'Retry-After': String(result.retryAfter || 60),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Backend': result.backend,
      },
    }
  }
  return null
}
