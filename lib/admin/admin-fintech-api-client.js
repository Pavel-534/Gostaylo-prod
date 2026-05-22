/**
 * Stage 111.1 / 113.0 — клиент API FinTech-пульта (/admin/settings/finances).
 */

import { dedupeClientRequest, invalidateClientRequestPrefix } from '@/lib/api/client-request-dedup'
import { TTL_FINTECH_BUNDLE_MS } from '@/lib/api/client-fetch-policy'

async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

/** Скачать blob через временную ссылку (CSV/ZIP). */
export function triggerFintechBlobDownload(blob, filename) {
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  a.click()
  URL.revokeObjectURL(objectUrl)
}

export async function fetchFintechConsoleBundle({ from, to, excludeTest = true } = {}) {
  const cacheKey = `fintech:bundle:${from}:${to}:${excludeTest ? 1 : 0}`
  return dedupeClientRequest(
    cacheKey,
    async () => {
      const ex = excludeTest ? '&excludeTest=1' : ''
      const exQ = excludeTest ? 'excludeTest=1' : ''
      const [dRes, pRes, bRes, mRes, opsRes] = await Promise.all([
        fetch(`/api/admin/finances/dashboard?${exQ}`, { cache: 'no-store' }),
        fetch('/api/admin/finances/pricing-profiles', { cache: 'no-store' }),
        fetch(`/api/admin/finances/payout-batches${exQ ? `?${exQ}` : ''}`, { cache: 'no-store' }),
        fetch(`/api/admin/finances/conversions?from=${from}&to=${to}${ex}`, {
          credentials: 'include',
          cache: 'no-store',
        }),
        fetch('/api/admin/finances/treasury-ops', { cache: 'no-store' }),
      ])
      const [dJson, pJson, bJson, mJson, opsJson] = await Promise.all([
        readJson(dRes),
        readJson(pRes),
        readJson(bRes),
        readJson(mRes),
        readJson(opsRes),
      ])
      return {
        dashboard: dJson.success ? dJson.data : null,
        profiles: pJson.success ? pJson.data || [] : [],
        batches: bJson.success ? bJson.data || [] : [],
        monthMargin: mJson.success ? mJson.data?.margin || null : null,
        treasuryOps: opsJson.success ? opsJson.data?.ops || null : null,
        cronHealth: opsJson.success ? opsJson.data?.cronHealth || null : null,
        productionReadiness: opsJson.success ? opsJson.data?.productionReadiness || null : null,
        errors: [],
      }
    },
    { ttlMs: TTL_FINTECH_BUNDLE_MS },
  )
}

/** После мутаций пула/профилей — сброс кэша bundle. */
export function invalidateFintechConsoleBundleCache() {
  invalidateClientRequestPrefix('fintech:bundle:')
}

export async function patchFintechPricingV2(enabled) {
  const res = await fetch('/api/admin/finances/pricing-v2', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  })
  const json = await readJson(res)
  return { ok: res.ok && json.success, json, status: res.status }
}

export async function postFintechPricingSimulate(body) {
  const res = await fetch('/api/admin/finances/pricing-profiles/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await readJson(res)
  return { ok: res.ok && json.success, data: json.data?.breakdown || json.data, json, status: res.status }
}

export async function saveFintechPricingProfile({ editingId, draft }) {
  const url = editingId
    ? `/api/admin/finances/pricing-profiles/${editingId}`
    : '/api/admin/finances/pricing-profiles'
  const method = editingId ? 'PATCH' : 'POST'
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...draft,
      guest_fee_pct: Number(draft.guest_fee_pct),
      ru_agent_share_pct: Number(draft.ru_agent_share_pct),
      kr_service_share_pct: Number(draft.kr_service_share_pct),
      host_fee_pct: Number(draft.host_fee_pct || 0),
      fx_markup_pct: Number(draft.fx_markup_pct || 0),
    }),
  })
  const json = await readJson(res)
  return { ok: res.ok && json.success, json, status: res.status }
}

export async function deleteFintechPricingProfile(id) {
  const res = await fetch(`/api/admin/finances/pricing-profiles/${id}`, { method: 'DELETE' })
  const json = await readJson(res)
  return { ok: res.ok && json.success, json, status: res.status }
}

export async function postFintechSmokeFinancialRun(body) {
  const res = await fetch('/api/admin/smoke/financial-run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await readJson(res).catch(() => ({}))
  return { ok: res.ok && (json.data?.ok ?? json.ok), data: json.data || json, json, status: res.status }
}

export async function postFintechPayoutBatch(body) {
  const res = await fetch('/api/admin/finances/payout-batches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await readJson(res)
  return { ok: res.ok && json.success, json, status: res.status }
}

export async function patchFintechPayoutBatch(id, action) {
  const res = await fetch(`/api/admin/finances/payout-batches/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  })
  const json = await readJson(res)
  return { ok: res.ok && json.success !== false, json, status: res.status }
}

export async function postFintechFiscalRetry(bookingId) {
  const res = await fetch(`/api/admin/finances/fiscal-retry/${bookingId}`, { method: 'POST' })
  const json = await readJson(res)
  return { ok: res.ok && json.success, json, status: res.status }
}

export async function postFintechFiscalTest() {
  const res = await fetch('/api/admin/finances/fiscal-test', { method: 'POST' })
  const json = await readJson(res)
  return { ok: res.ok && json.success, json, status: res.status }
}

export async function fetchFintechLedgerReconciliation() {
  const res = await fetch('/api/v2/admin/ledger-reconciliation', { credentials: 'include' })
  const json = await readJson(res)
  return { ok: res.ok && json.success, data: json.data, json, status: res.status }
}

export async function fetchFintechDownloadBlob(url) {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) {
    const json = await readJson(res)
    throw new Error(json.error || `HTTP ${res.status}`)
  }
  const blob = await res.blob()
  const disposition = res.headers.get('content-disposition') || ''
  const match = disposition.match(/filename="?([^";]+)"?/i)
  return {
    blob,
    filename: match?.[1] || 'download.csv',
    rowCount: Number(res.headers.get('x-export-row-count') || 0),
    isEmpty: res.headers.get('x-export-empty') === '1',
    contentType: res.headers.get('content-type') || '',
  }
}

export async function fetchFintechConversions(query) {
  const qs = query instanceof URLSearchParams ? query : new URLSearchParams(query)
  const res = await fetch(`/api/admin/finances/conversions?${qs.toString()}`, {
    credentials: 'include',
  })
  const json = await readJson(res)
  return { ok: res.ok && json.success, data: json.data, json, status: res.status }
}

export async function postFintechConversion(body) {
  const res = await fetch('/api/admin/finances/conversions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  const json = await readJson(res)
  return { ok: res.ok && json.success, data: json.data, json, status: res.status }
}

export async function fetchFintechConversionsReconcile(from, to) {
  const qs = new URLSearchParams({ from, to })
  const res = await fetch(`/api/admin/finances/conversions/reconcile?${qs.toString()}`, {
    credentials: 'include',
  })
  const json = await readJson(res)
  return { ok: res.ok && json.success, data: json.data, json, status: res.status }
}

export async function fetchFintechMovements(query) {
  const qs = query instanceof URLSearchParams ? query : new URLSearchParams(query)
  const res = await fetch(`/api/admin/finances/movements?${qs.toString()}`, {
    credentials: 'include',
  })
  const json = await readJson(res)
  return {
    ok: res.ok && json.success,
    movements: json.data?.movements || [],
    json,
    status: res.status,
  }
}

export async function fetchFintechTreasuryOps() {
  const res = await fetch('/api/admin/finances/treasury-ops')
  const json = await readJson(res)
  return { ok: json.success, data: json.data, json, status: res.status }
}

export async function patchFintechTreasuryOps(body) {
  const res = await fetch('/api/admin/finances/treasury-ops', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await readJson(res)
  return { ok: json.success, data: json.data, json, status: res.status }
}

export async function postFintechPreparePause(body) {
  const res = await fetch('/api/admin/finances/prepare-pause', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const contentType = res.headers.get('content-type') || ''
  if (!res.ok) {
    const json = await readJson(res)
    return { ok: false, json, status: res.status }
  }
  if (contentType.includes('application/json')) {
    const json = await readJson(res)
    return { ok: Boolean(json.success), json, status: res.status }
  }
  const blob = await res.blob()
  return {
    ok: true,
    blob,
    smokeOk: res.headers.get('X-Smoke-Ok') === '1',
    status: res.status,
  }
}

export async function postAdminCleanTestData(body) {
  const res = await fetch('/api/admin/clean-test-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  const json = await readJson(res)
  return { ok: res.ok && json.success, data: json.data, json, status: res.status }
}

export async function postLegalTestFullPackage(body) {
  const res = await fetch('/api/admin/settings/legal/test-full-package', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await readJson(res)
  return { ok: res.ok && json.success, data: json.data, json, status: res.status }
}

/** Stage 114.2 / 114.4 — Referral Liability snapshot для FinTech-пульта. */
export async function fetchReferralLiabilitySnapshot(params = {}) {
  const qs = new URLSearchParams()
  const entries = {
    periodFrom: params.periodFrom,
    periodTo: params.periodTo,
    status: params.status,
    type: params.type,
    topLimit: params.topLimit,
    accrualLimit: params.accrualLimit,
  }
  for (const [key, value] of Object.entries(entries)) {
    if (value != null && value !== '') qs.set(key, String(value))
  }
  const suffix = qs.toString() ? `?${qs}` : ''
  const res = await fetch(`/api/v2/admin/referral/liability${suffix}`, {
    credentials: 'include',
    cache: 'no-store',
  })
  const json = await readJson(res)
  return {
    ok: res.ok && json.success === true,
    data: json.data ?? null,
    error: json.error || (res.ok ? null : `HTTP ${res.status}`),
  }
}

/** Stage 114.4 — CSV export referral_ledger (browser download). */
/** Stage 114.5 — hold / release_hold / reject referral_ledger row. */
export async function patchReferralLedgerAdmin(ledgerId, body) {
  const id = String(ledgerId || '').trim()
  const res = await fetch(`/api/v2/admin/referral/ledger/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await readJson(res)
  return {
    ok: res.ok && json.success === true,
    data: json.data ?? null,
    error: json.error || (res.ok ? null : `HTTP ${res.status}`),
  }
}

/** Stage 114.6 — массовый approve/reject referral withdrawal queue. */
export async function postReferralPayoutBulk({ action, userIds }) {
  const res = await fetch('/api/v2/admin/wallet/payouts/referral-bulk', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, userIds }),
  })
  const json = await readJson(res)
  return {
    ok: res.ok && json.success === true,
    data: json.data ?? null,
    error: json.error || (res.ok ? null : `HTTP ${res.status}`),
  }
}

/** Stage 114.6 — hold_all_pending | release_all_held по фильтру ledger. */
export async function postReferralLedgerBulk(body) {
  const res = await fetch('/api/v2/admin/referral/ledger-bulk', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await readJson(res)
  return {
    ok: res.ok && json.success === true,
    data: json.data ?? null,
    error: json.error || (res.ok ? null : `HTTP ${res.status}`),
  }
}

export function referralLedgerExportUrl(filters = {}) {
  const qs = new URLSearchParams({ format: 'csv' })
  const keys = ['status', 'type', 'referralType', 'dateFrom', 'dateTo', 'referrerId', 'bookingId', 'limit']
  for (const key of keys) {
    const v = filters[key]
    if (v != null && v !== '') qs.set(key, String(v))
  }
  return `/api/v2/admin/referral/ledger-export?${qs}`
}
