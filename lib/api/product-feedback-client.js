/**
 * Client for POST /api/v2/feedback (product feedback, not chat escalate).
 */

async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

/**
 * @param {{
 *   category: string,
 *   details: string,
 *   pathname?: string,
 *   pageUrl?: string,
 *   userAgent?: string,
 *   language?: string,
 *   currency?: string,
 * }} payload
 */
export async function postProductFeedback(payload) {
  const res = await fetch('/api/v2/feedback', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category: payload.category,
      details: payload.details,
      pathname: payload.pathname,
      pageUrl: payload.pageUrl,
      userAgent: payload.userAgent,
      language: payload.language,
      currency: payload.currency,
    }),
  })
  const json = await readJson(res)
  return {
    ok: res.ok && json.success === true,
    error: json.error ?? null,
    status: res.status,
  }
}
