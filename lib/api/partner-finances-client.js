/**
 * Stage 55.0 — browser fetch helpers for partner finances (used by `usePartnerFinances`).
 * SSOT for URLs and JSON error shaping; hooks keep only React state + TanStack wiring.
 */

const defaultFetch = (url, init = {}) =>
  fetch(url, {
    cache: 'no-store',
    credentials: 'include',
    ...init,
  })

async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

export async function fetchPartnerPayouts(fetchImpl = defaultFetch) {
  const res = await fetchImpl('/api/v2/partner/payouts')
  const data = await readJson(res)
  if (!res.ok) {
    throw new Error(data?.error || 'Failed to fetch payouts')
  }
  return data.data ?? []
}

/** Balance + escrow buckets + recent ledger rows (partner dashboard / finances). */
export async function fetchPartnerBalanceBreakdown(fetchImpl = defaultFetch) {
  const res = await fetchImpl('/api/v2/partner/balance-breakdown')
  const json = await readJson(res)
  if (!res.ok) {
    throw new Error(json?.error || 'Failed to fetch balance')
  }
  return json.data
}

export async function fetchPartnerBookingsForFinances(partnerId, fetchImpl = defaultFetch) {
  if (!partnerId) throw new Error('No partner ID')
  const res = await fetchImpl(`/api/v2/partner/bookings?partnerId=${encodeURIComponent(partnerId)}`)
  const data = await readJson(res)
  if (!res.ok) {
    const msg =
      data?.error ||
      (res.status === 401 ? 'Auth required' : res.status === 403 ? 'Access denied' : 'Failed to fetch')
    throw new Error(msg)
  }
  return data.data ?? []
}

export async function fetchPartnerFinancesSummary(fetchImpl = defaultFetch) {
  const res = await fetchImpl('/api/v2/partner/finances-summary')
  const json = await readJson(res)
  if (!res.ok) {
    throw new Error(json?.error || 'Failed to fetch finances summary')
  }
  return json.data
}

export async function fetchDefaultPartnerPayoutProfile(fetchImpl = defaultFetch) {
  const res = await fetchImpl('/api/v2/partner/payout-profiles?default=1')
  const json = await readJson(res)
  if (!res.ok || !json?.success) return null
  return Array.isArray(json.data) ? json.data[0] || null : null
}

export async function fetchAuthMe(fetchImpl = defaultFetch) {
  const res = await fetchImpl('/api/v2/auth/me')
  if (!res.ok) return { ok: false, user: null }
  const body = await readJson(res)
  return { ok: true, user: body?.user ?? null, raw: body }
}

export async function fetchExchangeRatesRetail(fetchImpl = defaultFetch) {
  const res = await fetchImpl('/api/v2/exchange-rates?retail=0')
  if (!res.ok) return null
  const fx = await readJson(res)
  const map = fx?.rateMap && typeof fx.rateMap === 'object' ? fx.rateMap : { THB: 1 }
  return { THB: 1, ...map }
}

/**
 * @param {Record<string, unknown>} payload — same body as `POST /api/v2/partner/payouts/request`
 */
export async function requestPartnerPayout(payload, fetchImpl = defaultFetch) {
  const res = await fetchImpl('/api/v2/partner/payouts/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json = await readJson(res)
  return { res, json }
}

export async function fetchFinancesStatementPdf({ from, to }, fetchImpl = defaultFetch) {
  const qs = new URLSearchParams({ from, to })
  const res = await fetchImpl(`/api/v2/partner/finances-statement-pdf?${qs}`)
  if (!res.ok) {
    let detail = ''
    try {
      const j = await readJson(res)
      if (j?.error) detail = String(j.error)
    } catch {
      /* ignore */
    }
    throw new Error(detail || 'PDF request failed')
  }
  return res.blob()
}
