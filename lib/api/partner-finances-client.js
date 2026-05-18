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

/** All payout profiles (for rail picker in withdraw modal). */
export async function fetchPartnerPayoutProfiles(fetchImpl = defaultFetch) {
  const res = await fetchImpl('/api/v2/partner/payout-profiles')
  const json = await readJson(res)
  if (!res.ok || !json?.success) return []
  return Array.isArray(json.data) ? json.data : []
}

/**
 * Server-side payout preview (THB fee + payout FX spread).
 * @param {{ amountThb?: number, payoutProfileId?: string }} params
 */
export async function fetchPartnerPayoutPreview(params = {}, fetchImpl = defaultFetch) {
  const qs = new URLSearchParams()
  if (params.amountThb != null) qs.set('amountThb', String(params.amountThb))
  if (params.payoutProfileId) qs.set('payoutProfileId', params.payoutProfileId)
  const res = await fetchImpl(`/api/v2/partner/payouts/preview?${qs}`)
  const json = await readJson(res)
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || 'Preview failed')
  }
  return json.data
}

/**
 * Batch payout preview for transaction rows / portfolio (Stage 100.8).
 * @param {{ amountsThb: number[], payoutProfileId?: string }} params
 */
export async function fetchPartnerPayoutPreviewBatch(params = {}, fetchImpl = defaultFetch) {
  const res = await fetchImpl('/api/v2/partner/payouts/preview-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amountsThb: params.amountsThb || [],
      payoutProfileId: params.payoutProfileId,
    }),
  })
  const json = await readJson(res)
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || 'Preview batch failed')
  }
  return json.data
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
 * Partner withdrawal request — **live** path `POST /api/v2/partner/payouts` (not Stage 47.1 stub).
 * @param {{ partnerId: string, amount: number, method?: string, payoutProfileId?: string, walletAddress?: string, bankAccount?: string }} payload
 */
export async function requestPartnerPayout(payload, fetchImpl = defaultFetch) {
  const amount = Number(payload.amount ?? payload.availableThb ?? 0)
  const res = await fetchImpl('/api/v2/partner/payouts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      partnerId: payload.partnerId,
      amount,
      method: payload.method || 'MANUAL',
      payoutProfileId: payload.payoutProfileId ?? null,
      walletAddress: payload.walletAddress ?? null,
      bankAccount: payload.bankAccount ?? null,
    }),
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
