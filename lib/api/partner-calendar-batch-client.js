/**
 * Client SSOT for POST /api/v2/partner/calendar/batch (Stage 188.0).
 */

async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

/**
 * @param {{ operations: object[] }} body
 */
export async function postPartnerCalendarBatch(body) {
  const res = await fetch('/api/v2/partner/calendar/batch', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await readJson(res)
  return {
    ok: res.ok,
    status: res.status,
    json,
    data: json.data,
  }
}
