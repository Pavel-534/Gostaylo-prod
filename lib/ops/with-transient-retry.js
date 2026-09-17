/**
 * Stage 202.42 — retry read-only / outbound ops on transient infra blips only.
 * Do NOT wrap money writes (booking status, ledger, escrow, payout) with this helper.
 */

import { isTransientOpsError } from '@/lib/ops/is-transient-ops-error.js'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{
 *   attempts?: number
 *   baseDelayMs?: number
 *   label?: string
 *   isRetryable?: (err: unknown) => boolean
 * }} [opts]
 * @returns {Promise<T>}
 */
export async function withTransientRetry(fn, opts = {}) {
  const attempts = Math.min(4, Math.max(1, Math.floor(Number(opts.attempts) || 2)))
  const baseDelayMs = Math.max(50, Math.floor(Number(opts.baseDelayMs) || 250))
  const isRetryable =
    typeof opts.isRetryable === 'function' ? opts.isRetryable : isTransientOpsError
  const label = opts.label || 'transient-retry'

  let lastErr
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const retry = attempt < attempts && isRetryable(err)
      if (!retry) throw err
      const delay = baseDelayMs * 2 ** (attempt - 1)
      console.warn(`[${label}] attempt ${attempt}/${attempts} failed, retry in ${delay}ms:`, err?.message || err)
      await sleep(delay)
    }
  }
  throw lastErr
}

/**
 * Retry a Supabase `{ data, error }` call when `error` looks transient.
 * @template T
 * @param {() => Promise<{ data?: T, error?: unknown }>} fn
 * @param {{ attempts?: number, baseDelayMs?: number, label?: string }} [opts]
 */
export async function withTransientSupabaseRead(fn, opts = {}) {
  const attempts = Math.min(4, Math.max(1, Math.floor(Number(opts.attempts) || 2)))
  const baseDelayMs = Math.max(50, Math.floor(Number(opts.baseDelayMs) || 250))
  const label = opts.label || 'supabase-read'

  let last = { data: null, error: null }
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      last = await fn()
      if (!last?.error) return last
      if (attempt < attempts && isTransientOpsError(last.error)) {
        const delay = baseDelayMs * 2 ** (attempt - 1)
        console.warn(
          `[${label}] attempt ${attempt}/${attempts} error, retry in ${delay}ms:`,
          last.error?.message || last.error,
        )
        await sleep(delay)
        continue
      }
      return last
    } catch (err) {
      last = { data: null, error: err }
      if (attempt < attempts && isTransientOpsError(err)) {
        const delay = baseDelayMs * 2 ** (attempt - 1)
        console.warn(`[${label}] attempt ${attempt}/${attempts} threw, retry in ${delay}ms:`, err?.message || err)
        await sleep(delay)
        continue
      }
      return last
    }
  }
  return last
}
