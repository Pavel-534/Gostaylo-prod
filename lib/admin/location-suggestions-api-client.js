/**
 * Stage 162 — admin location suggestions queue API client.
 */

/**
 * @param {{ status?: string, limit?: number, offset?: number }} [opts]
 */
export async function fetchLocationSuggestionsQueue(opts = {}) {
  const params = new URLSearchParams()
  params.set('status', opts.status || 'PENDING')
  if (opts.limit != null) params.set('limit', String(opts.limit))
  if (opts.offset != null) params.set('offset', String(opts.offset))

  const res = await fetch(`/api/v2/admin/locations/suggestions?${params.toString()}`, {
    credentials: 'include',
    cache: 'no-store',
  })
  const data = await res.json()
  if (!res.ok || !data.success) {
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return data.data
}

/**
 * @param {string} id
 * @param {{ action: 'MERGE' | 'REJECT', target_code?: string, target_type?: string, reject_reason?: string }} body
 */
export async function resolveLocationSuggestion(id, body) {
  const res = await fetch(`/api/v2/admin/locations/suggestions/${encodeURIComponent(id)}/resolve`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok || !data.success) {
    const err = new Error(data.error || `HTTP ${res.status}`)
    err.code = data.code
    err.status = res.status
    throw err
  }
  return data.data
}

/**
 * Snapshot for stats strip (remaining unverified, last normalize run).
 */
export async function fetchAdminHealthLocationStats() {
  const res = await fetch('/api/v2/admin/health', { credentials: 'include', cache: 'no-store' })
  const data = await res.json()
  if (!res.ok || !data.success) return null
  return {
    locationNormalize: data.locationNormalize ?? null,
    locationSuggest: data.locationSuggest ?? null,
  }
}
