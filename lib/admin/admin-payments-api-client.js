/**
 * Stage 111.0 — клиент API админ-страницы верификации платежей (/admin/finances).
 */

async function parseJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

export async function fetchAdminPaymentsList({ activeFilter = 'all' } = {}) {
  let url = '/api/v2/payments?'
  if (activeFilter !== 'all') {
    if (['PENDING', 'CONFIRMED', 'FAILED'].includes(activeFilter)) {
      url += `status=${activeFilter}&`
    } else {
      url += `paymentMethod=${activeFilter}&`
    }
  }
  const res = await fetch(url)
  const data = await parseJson(res)
  return { ok: res.ok && data.success, data, status: res.status }
}

export async function fetchAdminPaymentsPendingCount() {
  const res = await fetch('/api/v2/payments?count=pending')
  const data = await parseJson(res)
  return { ok: res.ok, count: data.count || 0, data, status: res.status }
}

export async function fetchPaymentAdaptersHealth() {
  const res = await fetch('/api/v2/admin/payment-adapters/health', { cache: 'no-store' })
  const data = await parseJson(res)
  return {
    ok: res.ok && data?.success,
    data: data?.data || null,
    raw: data,
    status: res.status,
  }
}

export async function verifyTronPayment({ txid, bookingId }) {
  const res = await fetch('/api/v2/payments/verify-tron', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txid, bookingId }),
  })
  const data = await parseJson(res)
  return { ok: res.ok, data, status: res.status }
}

export async function postPaymentAction(payload) {
  const res = await fetch('/api/v2/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await parseJson(res)
  return { ok: res.ok && data.success, data, status: res.status }
}
