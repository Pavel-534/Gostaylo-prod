/**
 * Stage 210.7 — client SSOT for /admin/concierge (no raw fetch in page beyond this module).
 */

export async function fetchConciergePrompt() {
  const res = await fetch('/api/v2/admin/concierge/prompt', {
    credentials: 'include',
    cache: 'no-store',
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || 'Не удалось загрузить промпт')
  }
  return json.prompt
}

export async function validateConciergePayloadClient(body) {
  const res = await fetch('/api/v2/admin/concierge/validate-payload', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, ...json }
}

export async function provisionConciergePartnerClient(body) {
  const res = await fetch('/api/v2/admin/concierge/partners', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || 'Не удалось создать shadow-партнёра')
  }
  return json
}

export async function ingestConciergeClient(body) {
  const res = await fetch('/api/v2/admin/concierge/ingest', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || 'Ingest не выполнен')
  }
  return json
}

export async function createConciergeClaimInviteClient(body) {
  const res = await fetch('/api/v2/admin/concierge/claim-invites', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || 'Не удалось создать claim-инвайт')
  }
  return json
}

export async function fetchConciergeBatches({ page = 1, limit = 20 } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })
  const res = await fetch(`/api/v2/admin/concierge/batches?${params}`, {
    credentials: 'include',
    cache: 'no-store',
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || 'Не удалось загрузить журнал батчей')
  }
  return json
}

export async function fetchConciergeBatchDetail(batchId) {
  const res = await fetch(`/api/v2/admin/concierge/batches/${encodeURIComponent(batchId)}`, {
    credentials: 'include',
    cache: 'no-store',
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || 'Не удалось загрузить объекты батча')
  }
  return json
}

export async function searchConciergePartnersClient(q) {
  const params = new URLSearchParams({ q: String(q || ''), limit: '15' })
  const res = await fetch(`/api/v2/admin/concierge/partner-search?${params}`, {
    credentials: 'include',
    cache: 'no-store',
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || 'Поиск партнёров не удался')
  }
  return json.items || []
}
