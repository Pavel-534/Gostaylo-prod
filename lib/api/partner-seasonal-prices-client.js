/**
 * Stage 112.3 — SSOT seasonal prices API (wizard + SeasonalPriceManager).
 */

async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

const defaultInit = { credentials: 'include', cache: 'no-store' }

export async function fetchSeasonalPricesByListing(listingId) {
  const res = await fetch(`/api/v2/partner/seasonal-prices?listingId=${encodeURIComponent(listingId)}`, {
    ...defaultInit,
  })
  const json = await readJson(res)
  return {
    ok: res.ok && (json.status === 'success' || json.success === true),
    data: json.data ?? [],
    json,
    status: res.status,
  }
}

export async function createSeasonalPrice(body) {
  const res = await fetch('/api/v2/partner/seasonal-prices', {
    ...defaultInit,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await readJson(res)
  return { ok: res.ok && (json.status === 'success' || json.success === true), json, status: res.status }
}

/** Edit flow in UI: delete old row then POST new (legacy contract). */
export async function replaceSeasonalPrice(editingId, body) {
  await deleteSeasonalPrice(editingId)
  return createSeasonalPrice(body)
}

export async function deleteSeasonalPrice(priceId) {
  const res = await fetch(`/api/v2/partner/seasonal-prices?id=${encodeURIComponent(priceId)}`, {
    ...defaultInit,
    method: 'DELETE',
  })
  const json = await readJson(res)
  return { ok: res.ok && (json.status === 'success' || json.success === true), json, status: res.status }
}
