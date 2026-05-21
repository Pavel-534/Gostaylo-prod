/**
 * Stage 113.0 — in-flight + short TTL deduplication for browser fetch (API clients).
 * Server Components should use native `fetch` + `next.revalidate` instead.
 */

const inFlight = new Map()
const resultCache = new Map()

/**
 * @param {string} key
 * @param {() => Promise<T>} fn
 * @param {{ ttlMs?: number }} [opts] — ttlMs=0: only dedupe concurrent identical calls
 * @returns {Promise<T>}
 * @template T
 */
export function dedupeClientRequest(key, fn, { ttlMs = 0 } = {}) {
  const now = Date.now()
  if (ttlMs > 0) {
    const hit = resultCache.get(key)
    if (hit && now - hit.at < ttlMs) {
      return Promise.resolve(hit.value)
    }
  }

  const pending = inFlight.get(key)
  if (pending) return pending

  const promise = Promise.resolve()
    .then(fn)
    .then((value) => {
      if (ttlMs > 0) {
        resultCache.set(key, { value, at: Date.now() })
      }
      inFlight.delete(key)
      return value
    })
    .catch((err) => {
      inFlight.delete(key)
      throw err
    })

  inFlight.set(key, promise)
  return promise
}

/** @param {string} key */
export function invalidateClientRequest(key) {
  resultCache.delete(key)
  inFlight.delete(key)
}

/** @param {string} prefix */
export function invalidateClientRequestPrefix(prefix) {
  for (const k of [...resultCache.keys()]) {
    if (k.startsWith(prefix)) resultCache.delete(k)
  }
  for (const k of [...inFlight.keys()]) {
    if (k.startsWith(prefix)) inFlight.delete(k)
  }
}

/** После logout — сброс сессионных и чатовых снимков. */
export function invalidateAllClientRequests() {
  resultCache.clear()
  inFlight.clear()
}
