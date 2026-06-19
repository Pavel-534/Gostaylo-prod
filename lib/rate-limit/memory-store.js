/**
 * Stage 168.2 — in-memory fixed-window counter (fallback when Redis/KV unavailable).
 */

const store = new Map()
const CLEANUP_INTERVAL = 60 * 1000
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  for (const [key, data] of store.entries()) {
    if (data.expiresAt < now) store.delete(key)
  }
}

if (typeof setInterval !== 'undefined') {
  setInterval(cleanup, CLEANUP_INTERVAL)
}

/**
 * @param {string} key
 * @param {{ windowMs: number, max: number }} config
 * @returns {{ allowed: boolean, remaining: number, limit: number, retryAfter?: number }}
 */
export function checkMemoryRateLimit(key, config) {
  const now = Date.now()
  let data = store.get(key)
  if (!data || data.expiresAt < now) {
    data = { count: 0, expiresAt: now + config.windowMs }
    store.set(key, data)
  }

  data.count += 1
  const remaining = Math.max(0, config.max - data.count)
  const allowed = data.count <= config.max

  if (Date.now() - lastCleanup > CLEANUP_INTERVAL) {
    cleanup()
    lastCleanup = Date.now()
  }

  return {
    allowed,
    remaining,
    limit: config.max,
    retryAfter: allowed ? undefined : Math.max(1, Math.ceil((data.expiresAt - now) / 1000)),
  }
}
