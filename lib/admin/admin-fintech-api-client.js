/**
 * Stage 111.1 — клиент API FinTech-пульта (/admin/settings/finances).
 */

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
  const ex = excludeTest ? '&excludeTest=1' : ''
  const exQ = excludeTest ? 'excludeTest=1' : ''
  const [dRes, pRes, bRes, mRes, opsRes] = await Promise.all([
    fetch(`/api/admin/finances/dashboard?${exQ}`),
    fetch('/api/admin/finances/pricing-profiles'),
    fetch(`/api/admin/finances/payout-batches${exQ ? `?${exQ}` : ''}`),
    fetch(`/api/admin/finances/conversions?from=${from}&to=${to}${ex}`, { credentials: 'include' }),
    fetch('/api/admin/finances/treasury-ops'),
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
