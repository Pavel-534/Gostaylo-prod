/**
 * Stage 112.2 — SSOT browser fetch для партнёрских броней (чат, peek, хуки).
 */

async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

export async function fetchPartnerBookingById(bookingId) {
  const res = await fetch(`/api/v2/partner/bookings/${encodeURIComponent(String(bookingId))}`, {
    credentials: 'include',
    cache: 'no-store',
  })
  const json = await readJson(res)
  return {
    ok: res.ok && json?.status !== 'error',
    data: json?.data ?? null,
    financialSnapshot: json?.data?.financial_snapshot ?? null,
    json,
    status: res.status,
  }
}

export async function updatePartnerBookingStatus(bookingId, { status, reason, partnerId } = {}) {
  const qs = partnerId ? `?partnerId=${encodeURIComponent(partnerId)}` : ''
  const res = await fetch(`/api/v2/partner/bookings/${encodeURIComponent(String(bookingId))}${qs}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, ...(reason != null ? { reason } : {}) }),
  })
  const json = await readJson(res)
  return {
    ok: res.ok && json?.status === 'success',
    json,
    status: res.status,
  }
}
