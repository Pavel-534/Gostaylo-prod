/**
 * Stage 112.3 — renter booking cancel flow.
 */

async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

export async function fetchBookingCancelPreview(bookingId) {
  const res = await fetch(`/api/v2/bookings/${encodeURIComponent(bookingId)}/cancel-preview`, {
    credentials: 'include',
    cache: 'no-store',
  })
  const json = await readJson(res)
  return { ok: res.ok && json.success === true, data: json.data ?? null, json, status: res.status }
}

export async function postBookingCancel(bookingId, body) {
  const res = await fetch(`/api/v2/bookings/${encodeURIComponent(bookingId)}/cancel`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await readJson(res)
  return { ok: res.ok && json.success === true, json, status: res.status }
}
