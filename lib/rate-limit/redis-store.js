/**
 * Stage 168.2 — distributed fixed-window counter via Vercel KV / Upstash Redis REST.
 *
 * Priority: Vercel KV (`KV_REST_API_*`) → Upstash direct (`UPSTASH_REDIS_REST_*`) → caller falls back to memory.
 * Uses `@upstash/redis` — compatible with both Vercel KV and standalone Upstash.
 */

import { Redis } from '@upstash/redis'

/** @typedef {'kv' | 'upstash'} RemoteStoreKind */

/** @type {{ client: import('@upstash/redis').Redis, kind: RemoteStoreKind } | null | undefined} */
let resolved = undefined

let loggedActiveStore = false

/**
 * Resolve remote store credentials. Vercel KV wins over standalone Upstash.
 * @returns {{ url: string, token: string, kind: RemoteStoreKind } | null}
 */
export function resolveRemoteStoreConfig() {
  const kvUrl = String(process.env.KV_REST_API_URL || '').trim()
  const kvToken = String(process.env.KV_REST_API_TOKEN || '').trim()
  if (kvUrl && kvToken) {
    return { url: kvUrl, token: kvToken, kind: 'kv' }
  }

  const upstashUrl = String(process.env.UPSTASH_REDIS_REST_URL || '').trim()
  const upstashToken = String(process.env.UPSTASH_REDIS_REST_TOKEN || '').trim()
  if (upstashUrl && upstashToken) {
    return { url: upstashUrl, token: upstashToken, kind: 'upstash' }
  }

  return null
}

/**
 * @returns {'kv' | 'upstash' | null}
 */
export function getRemoteStoreKind() {
  const cfg = resolveRemoteStoreConfig()
  return cfg?.kind ?? null
}

/**
 * @returns {import('@upstash/redis').Redis | null}
 */
export function getRedisClient() {
  if (resolved !== undefined) return resolved?.client ?? null

  const cfg = resolveRemoteStoreConfig()
  if (!cfg) {
    resolved = null
    return null
  }

  resolved = {
    client: new Redis({ url: cfg.url, token: cfg.token }),
    kind: cfg.kind,
  }
  return resolved.client
}

export function isRemoteRateLimitConfigured() {
  return getRedisClient() != null
}

/** @deprecated use isRemoteRateLimitConfigured */
export function isRedisRateLimitConfigured() {
  return isRemoteRateLimitConfigured()
}

/**
 * Maps internal kind to public backend label for headers/logs.
 * @param {RemoteStoreKind} kind
 * @returns {'kv' | 'redis'}
 */
export function backendLabelForKind(kind) {
  return kind === 'kv' ? 'kv' : 'redis'
}

function logActiveStoreOnce(kind) {
  if (loggedActiveStore) return
  loggedActiveStore = true
  const label = backendLabelForKind(kind)
  console.info(`[rate-limit] Active store: ${label} (${kind === 'kv' ? 'Vercel KV' : 'Upstash Redis'})`)
}

/**
 * @param {string} key
 * @param {{ windowMs: number, max: number }} config
 * @returns {Promise<{ allowed: boolean, remaining: number, limit: number, retryAfter?: number, backend: 'kv' | 'redis' }>}
 */
export async function checkRemoteRateLimit(key, config) {
  const cfg = resolveRemoteStoreConfig()
  if (!cfg) {
    throw new Error('REMOTE_STORE_NOT_CONFIGURED')
  }

  const redis = getRedisClient()
  if (!redis) {
    throw new Error('REMOTE_STORE_NOT_CONFIGURED')
  }

  logActiveStoreOnce(cfg.kind)

  const redisKey = `rl:v1:${key}`
  const count = await redis.incr(redisKey)
  if (count === 1) {
    await redis.pexpire(redisKey, config.windowMs)
  }

  let ttlMs = await redis.pttl(redisKey)
  if (ttlMs < 0) {
    await redis.pexpire(redisKey, config.windowMs)
    ttlMs = config.windowMs
  }

  const remaining = Math.max(0, config.max - count)
  const allowed = count <= config.max

  return {
    allowed,
    remaining,
    limit: config.max,
    retryAfter: allowed ? undefined : Math.max(1, Math.ceil(ttlMs / 1000)),
    backend: backendLabelForKind(cfg.kind),
  }
}

/** @deprecated use checkRemoteRateLimit */
export async function checkRedisRateLimit(key, config) {
  const result = await checkRemoteRateLimit(key, config)
  return result
}
