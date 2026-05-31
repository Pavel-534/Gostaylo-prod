/**
 * Stage 124.5 — in-process short TTL cache for read-only analytics reports.
 * Request-scoped in serverless: warm instance reuse within ~90s window.
 */

const DEFAULT_TTL_MS = 90_000;
const MAX_ENTRIES = 32;

/** @type {Map<string, { value: unknown, expiresAt: number }>} */
const store = new Map();

function pruneIfNeeded() {
  if (store.size <= MAX_ENTRIES) return;
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
  if (store.size > MAX_ENTRIES) {
    const oldest = [...store.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    for (let i = 0; i < oldest.length - MAX_ENTRIES; i += 1) {
      store.delete(oldest[i][0]);
    }
  }
}

/**
 * @param {string} key
 */
export function getCachedAnalytics(key) {
  const entry = store.get(String(key));
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(String(key));
    return null;
  }
  return entry.value;
}

/**
 * @param {string} key
 * @param {unknown} value
 * @param {number} [ttlMs]
 */
export function setCachedAnalytics(key, value, ttlMs = DEFAULT_TTL_MS) {
  pruneIfNeeded();
  store.set(String(key), { value, expiresAt: Date.now() + ttlMs });
}

/**
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} loader
 * @param {{ ttlMs?: number }} [opts]
 * @returns {Promise<T & { cacheHit?: boolean }>}
 */
export async function withAnalyticsCache(key, loader, opts = {}) {
  const hit = getCachedAnalytics(key);
  if (hit) return { ...(/** @type {T} */ (hit)), cacheHit: true };
  const value = await loader();
  setCachedAnalytics(key, value, opts.ttlMs ?? DEFAULT_TTL_MS);
  return { ...value, cacheHit: false };
}

export function invalidateAnalyticsCache(prefix = '') {
  const p = String(prefix);
  for (const key of store.keys()) {
    if (!p || key.startsWith(p)) store.delete(key);
  }
}
