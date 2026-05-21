/**
 * Stage 112.3 / 113.1 — SSOT для /api/admin/settings и referral P&L monitor (admin cockpit).
 */

import {
  dedupeClientRequest,
  invalidateClientRequest,
} from '@/lib/api/client-request-dedup'

async function parseJson(res) {
  return res.json().catch(() => ({}))
}

export async function fetchAdminSettings() {
  return dedupeClientRequest(
    'admin:settings:general',
    async () => {
      const res = await fetch('/api/admin/settings', { cache: 'no-store' })
      const data = await parseJson(res)
      return { ok: res.ok, data: data?.data ?? null, json: data, status: res.status }
    },
    { ttlMs: 5_000 },
  )
}

export async function saveAdminSettings(payload) {
  const res = await fetch('/api/admin/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await parseJson(res)
  const out = {
    ok: res.ok && data?.success === true,
    data: data?.data ?? null,
    json: data,
    status: res.status,
    error: data?.error,
    details: data?.details,
  }
  if (out.ok) {
    invalidateClientRequest('admin:settings:general')
    invalidateClientRequest('admin:referral:pnl-monitor')
  }
  return out
}

export async function fetchReferralPnlMonitor() {
  return dedupeClientRequest(
    'admin:referral:pnl-monitor',
    async () => {
      const res = await fetch('/api/v2/admin/referral/pnl-monitor', {
        credentials: 'include',
        cache: 'no-store',
      })
      const data = await parseJson(res)
      return {
        ok: res.ok && data?.success === true,
        data: data?.data ?? null,
        json: data,
        status: res.status,
        error: data?.error,
      }
    },
    { ttlMs: 8_000 },
  )
}

export async function postReferralPnlMonitorTopup({ amountThb, note }) {
  const res = await fetch('/api/v2/admin/referral/pnl-monitor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      action: 'topup',
      amountThb,
      note,
    }),
  })
  const data = await parseJson(res)
  const out = {
    ok: res.ok && data?.success === true,
    data: data?.data ?? null,
    json: data,
    status: res.status,
    error: data?.error,
  }
  if (out.ok) invalidateClientRequest('admin:referral:pnl-monitor')
  return out
}
