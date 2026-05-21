/**
 * Stage 110.8 / 113.1 — клиентский SSOT для /admin/marketing (без прямого fetch в page).
 */

import {
  dedupeClientRequest,
  invalidateClientRequestPrefix,
} from '@/lib/api/client-request-dedup'

async function parseJson(res) {
  return res.json().catch(() => ({}))
}

function bustMarketingReadCache() {
  invalidateClientRequestPrefix('admin:marketing:')
}

export async function fetchMarketingUiStrings() {
  return dedupeClientRequest(
    'admin:marketing:ui-strings',
    async () => {
      const res = await fetch('/api/admin/marketing/ui-strings', { cache: 'no-store' })
      const data = await parseJson(res)
      return { ok: res.ok, data, status: res.status }
    },
    { ttlMs: 10_000 },
  )
}

export async function saveMarketingUiStrings(value) {
  const res = await fetch('/api/admin/marketing/ui-strings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  })
  const data = await parseJson(res)
  const out = { ok: res.ok, data, status: res.status }
  if (out.ok) bustMarketingReadCache()
  return out
}

export async function fetchTopPartnersPromoAnalytics() {
  return dedupeClientRequest(
    'admin:marketing:top-partners',
    async () => {
      const res = await fetch('/api/admin/promo-codes/analytics/top-partners', { cache: 'no-store' })
      const data = await parseJson(res)
      return {
        ok: res.ok,
        data: Array.isArray(data.data) ? data.data : [],
      }
    },
    { ttlMs: 30_000 },
  )
}

export async function fetchAdminPromoCodes() {
  return dedupeClientRequest(
    'admin:marketing:promo-codes',
    async () => {
      const res = await fetch('/api/admin/promo-codes', { cache: 'no-store' })
      const data = await parseJson(res)
      return {
        ok: res.ok,
        data: Array.isArray(data.data) ? data.data : [],
        error: data.error,
        status: res.status,
      }
    },
    { ttlMs: 15_000 },
  )
}

export async function fetchAdminMarketingCampaigns() {
  return dedupeClientRequest(
    'admin:marketing:campaigns',
    async () => {
      const res = await fetch('/api/admin/marketing/campaigns', { cache: 'no-store' })
      const data = await parseJson(res)
      return {
        ok: res.ok,
        data: Array.isArray(data.data) ? data.data : [],
        error: data.error,
        status: res.status,
      }
    },
    { ttlMs: 15_000 },
  )
}

export async function createAdminMarketingCampaign(payload) {
  const res = await fetch('/api/admin/marketing/campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await parseJson(res)
  const out = { ok: res.ok, data, status: res.status, error: data.error }
  if (out.ok) bustMarketingReadCache()
  return out
}

export async function createAdminPromoCode(payload) {
  const res = await fetch('/api/admin/promo-codes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await parseJson(res)
  const out = { ok: res.ok, data, status: res.status, error: data.error }
  if (out.ok) bustMarketingReadCache()
  return out
}

export async function deleteAdminPromoCode(id) {
  const res = await fetch(`/api/admin/promo-codes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  const data = await parseJson(res)
  const out = { ok: res.ok, data, error: data.error }
  if (out.ok) bustMarketingReadCache()
  return out
}

export async function patchAdminPromoCode(id, body) {
  const res = await fetch(`/api/admin/promo-codes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await parseJson(res)
  const out = { ok: res.ok, data, error: data.error, status: res.status }
  if (out.ok) bustMarketingReadCache()
  return out
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
  const out = { ok: res.ok, data, error: data.error }
  if (out.ok) bustMarketingReadCache()
  return out
}
