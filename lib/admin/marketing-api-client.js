/**
 * Stage 110.8 — клиентский SSOT для /admin/marketing (без прямого fetch в page).
 */

async function parseJson(res) {
  return res.json().catch(() => ({}))
}

export async function fetchMarketingUiStrings() {
  const res = await fetch('/api/admin/marketing/ui-strings')
  const data = await parseJson(res)
  return { ok: res.ok, data, status: res.status }
}

export async function saveMarketingUiStrings(value) {
  const res = await fetch('/api/admin/marketing/ui-strings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  })
  const data = await parseJson(res)
  return { ok: res.ok, data, status: res.status }
}

export async function fetchTopPartnersPromoAnalytics() {
  const res = await fetch('/api/admin/promo-codes/analytics/top-partners')
  const data = await parseJson(res)
  return {
    ok: res.ok,
    data: Array.isArray(data.data) ? data.data : [],
  }
}

export async function fetchAdminPromoCodes() {
  const res = await fetch('/api/admin/promo-codes')
  const data = await parseJson(res)
  return {
    ok: res.ok,
    data: Array.isArray(data.data) ? data.data : [],
    error: data.error,
    status: res.status,
  }
}

export async function fetchAdminMarketingCampaigns() {
  const res = await fetch('/api/admin/marketing/campaigns')
  const data = await parseJson(res)
  return {
    ok: res.ok,
    data: Array.isArray(data.data) ? data.data : [],
    error: data.error,
    status: res.status,
  }
}

export async function createAdminMarketingCampaign(payload) {
  const res = await fetch('/api/admin/marketing/campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await parseJson(res)
  return { ok: res.ok, data, status: res.status, error: data.error }
}

export async function createAdminPromoCode(payload) {
  const res = await fetch('/api/admin/promo-codes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await parseJson(res)
  return { ok: res.ok, data, status: res.status, error: data.error }
}

export async function deleteAdminPromoCode(id) {
  const res = await fetch(`/api/admin/promo-codes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  const data = await parseJson(res)
  return { ok: res.ok, data, error: data.error }
}

export async function patchAdminPromoCode(id, body) {
  const res = await fetch(`/api/admin/promo-codes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await parseJson(res)
  return { ok: res.ok, data, error: data.error, status: res.status }
}

export async function extendAdminPromoFlashSale(id, hours) {
  const res = await fetch(
    `/api/admin/promo-codes/${encodeURIComponent(id)}/extend-flash-sale`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hours }),
    },
  )
  const data = await parseJson(res)
  return { ok: res.ok, data, error: data.error }
}
