/**
 * Stage 128.0 — стандартный browser fetch для TanStack Query `queryFn`.
 * Не заменяет server-side `fetch`; только клиентские API routes с cookie-сессией.
 */

const defaultFetch = typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null

/**
 * @typedef {Object} QueryFetchJsonOptions
 * @property {string} [method]
 * @property {unknown} [body]
 * @property {Record<string, string>} [headers]
 * @property {typeof fetch} [fetchImpl]
 * @property {AbortSignal} [signal]
 */

/**
 * @typedef {Object} QueryFetchJsonResult
 * @property {boolean} ok
 * @property {number} status
 * @property {unknown} data
 * @property {Record<string, unknown>} raw
 */

export class QueryFetchError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, code?: string, raw?: Record<string, unknown> }} [meta]
   */
  constructor(message, meta = {}) {
    super(message)
    this.name = 'QueryFetchError'
    this.status = meta.status
    this.code = meta.code
    this.raw = meta.raw
  }
}

/**
 * @param {Response} res
 */
async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

/**
 * GET/POST/PATCH к app API с `credentials: 'include'` и разбором `{ success, data, error_code }`.
 *
 * @param {string} path — например `/api/v2/wallet/me`
 * @param {QueryFetchJsonOptions} [options]
 * @returns {Promise<unknown>} — `json.data` если есть, иначе весь `json` (для нестандартных ответов)
 */
export async function queryFetchJson(path, options = {}) {
  const {
    method = 'GET',
    body,
    headers = {},
    fetchImpl = defaultFetch,
    signal,
  } = options

  if (!fetchImpl) {
    throw new QueryFetchError('FETCH_UNAVAILABLE')
  }

  const hasBody = body !== undefined && body !== null
  const res = await fetchImpl(path, {
    method,
    credentials: 'include',
    cache: 'no-store',
    signal,
    headers: hasBody
      ? { 'Content-Type': 'application/json', ...headers }
      : headers,
    body: hasBody ? JSON.stringify(body) : undefined,
  })

  const raw = await readJson(res)
  const success = raw?.success !== false && res.ok

  if (!success) {
    const code =
      (typeof raw?.code === 'string' && raw.code) ||
      (typeof raw?.error_code === 'string' && raw.error_code) ||
      (typeof raw?.error === 'string' && raw.error) ||
      `HTTP_${res.status}`
    throw new QueryFetchError(code, { status: res.status, code, raw })
  }

  if (Object.prototype.hasOwnProperty.call(raw, 'data')) {
    return raw.data
  }

  return raw
}
