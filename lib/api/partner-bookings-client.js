/**
 * Stage 112.2 / 113.1 — SSOT browser fetch для партнёрских броней (чат, peek, хуки).
 */

import { dedupeClientRequest, invalidateClientRequest } from '@/lib/api/client-request-dedup'

async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

export async function fetchPartnerBookingById(bookingId) {
  const id = String(bookingId)
  return dedupeClientRequest(
    `partner:booking:${id}`,
    async () => {
      const res = await fetch(`/api/v2/partner/bookings/${encodeURIComponent(id)}`, {
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
    },
    { ttlMs: 0 },
  )
}

export async function updatePartnerBookingStatus(bookingId, payload = {}) {
  const { partnerId, ...body } = payload
  const qs = partnerId ? `?partnerId=${encodeURIComponent(partnerId)}` : ''
  const res = await fetch(`/api/v2/partner/bookings/${encodeURIComponent(String(bookingId))}${qs}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await readJson(res)
  const out = {
    ok: res.ok && json?.status === 'success',
    json,
    status: res.status,
  }
  if (out.ok) invalidateClientRequest(`partner:booking:${String(bookingId)}`)
  return out
}
