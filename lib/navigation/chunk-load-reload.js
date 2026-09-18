/**
 * Stage 202.43 — shared ChunkLoadError recovery (airento.ru proxy timeouts / stale deploy hashes).
 */

import { isClientNavFailure } from '@/lib/navigation/is-client-nav-failure.js'

export const CHUNK_RELOAD_GUARD_KEY = 'airento_chunk_reload_ts'
export const CHUNK_RELOAD_COOLDOWN_MS = 15_000

/**
 * @returns {boolean} true if caller may perform a graceful full reload now
 */
export function claimChunkGracefulReload() {
  if (typeof window === 'undefined') return false
  try {
    const last = parseInt(sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY) || '0', 10)
    if (Number.isFinite(last) && Date.now() - last < CHUNK_RELOAD_COOLDOWN_MS) return false
    sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, String(Date.now()))
    return true
  } catch {
    return true
  }
}

/**
 * One guarded hard reload when error looks like a client chunk / soft-nav failure.
 * @param {unknown} error
 * @returns {boolean} true if reload was triggered
 */
export function hardReloadForChunkFailure(error) {
  if (typeof window === 'undefined') return false
  if (!isClientNavFailure(error)) return false
  if (!claimChunkGracefulReload()) return false
  window.location.reload()
  return true
}

/**
 * Retry a dynamic `import()` once on ChunkLoadError / timeout (VPS proxy blips).
 * @template T
 * @param {() => Promise<T>} loader
 * @param {{ retries?: number, delayMs?: number }} [opts]
 * @returns {Promise<T>}
 */
export async function importWithChunkRetry(loader, opts = {}) {
  const retries = Number.isFinite(opts.retries) ? Math.max(0, opts.retries) : 1
  const delayMs = Number.isFinite(opts.delayMs) ? Math.max(0, opts.delayMs) : 450
  let lastError
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await loader()
    } catch (error) {
      lastError = error
      if (attempt >= retries || !isClientNavFailure(error)) throw error
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)))
    }
  }
  throw lastError
}
