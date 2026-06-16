/**
 * Stage 151.1 — transient network retry for financial smoke steps.
 */

const DEFAULT_ATTEMPTS = 3
const DEFAULT_DELAY_MS = 1000

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isTransientSmokeError(error) {
  const msg = String(error?.message || error || '').toLowerCase()
  const code = String(error?.code || error?.cause?.code || '').toLowerCase()
  if (msg.includes('fetch failed')) return true
  if (msg.includes('connecttimeouterror') || msg.includes('connect timeout')) return true
  if (msg.includes('econnreset') || msg.includes('econnrefused') || msg.includes('etimedout')) {
    return true
  }
  if (msg.includes('network') && msg.includes('error')) return true
  if (code === 'econnreset' || code === 'etimedout' || code === 'und_err_connect_timeout') {
    return true
  }
  return false
}

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ attempts?: number, delayMs?: number, label?: string }} [options]
 * @returns {Promise<T>}
 */
export async function withSmokeRetry(fn, options = {}) {
  const attempts = Math.max(1, Math.floor(Number(options.attempts) || DEFAULT_ATTEMPTS))
  const delayMs = Math.max(0, Math.floor(Number(options.delayMs) || DEFAULT_DELAY_MS))
  const label = options.label ? String(options.label) : 'smoke step'

  let lastError = null
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      const transient = isTransientSmokeError(error)
      if (!transient || i >= attempts) throw error
      console.warn(`[SMOKE_RETRY] ${label} attempt ${i}/${attempts} transient: ${error?.message || error}`)
      if (delayMs > 0) await sleep(delayMs)
    }
  }
  throw lastError
}

export default { withSmokeRetry, isTransientSmokeError }
