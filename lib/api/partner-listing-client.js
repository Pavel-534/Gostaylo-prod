/**
 * Stage 112.3 — SSOT partner listing fetch/patch (iCal sync manager).
 */

async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

const defaultInit = { credentials: 'include', cache: 'no-store' }

export async function fetchPartnerListing(listingId) {
  const res = await fetch(`/api/v2/partner/listings/${encodeURIComponent(listingId)}`, defaultInit)
  const json = await readJson(res)
  const listing = json?.success ? json.data || json.listing : null
  return { ok: Boolean(listing), listing, json, status: res.status }
}

export async function patchPartnerListing(listingId, body) {
  const res = await fetch(`/api/v2/partner/listings/${encodeURIComponent(listingId)}`, {
    ...defaultInit,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { ok: res.ok, json: await readJson(res), status: res.status }
}

export async function fetchPartnerReputationHealth() {
  const res = await fetch('/api/v2/partner/reputation-health', { credentials: 'include' })
  const json = await readJson(res)
  return {
    ok: res.ok && json.success === true,
    data: json.data ?? null,
    error: json.error ?? null,
    status: res.status,
  }
}

export async function fetchIcalExportLink(listingId) {
  const res = await fetch(`/api/v2/partner/listings/${encodeURIComponent(listingId)}/ical-export-link`, {
    credentials: 'include',
  })
  const json = await readJson(res)
  return {
    ok: res.ok && json.success === true,
    exportUrl: json.data?.exportUrl ?? null,
    json,
    status: res.status,
  }
}
