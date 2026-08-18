/**
 * Client fetch for the «For you» rail (Stage 201.98 — TanStack Query).
 */

/**
 * @param {string} [where]
 * @returns {Promise<{ listings: object[], meta: object | null }>}
 */
export async function fetchForYouRail(where = 'all') {
  const params = new URLSearchParams({ limit: '16' })
  if (where && where !== 'all') params.set('where', where)
  const res = await fetch(`/api/v2/recommendations/for-you?${params.toString()}`)
  const data = await res.json().catch(() => null)
  if (!data?.success) return { listings: [], meta: null }
  return {
    listings: Array.isArray(data.listings) ? data.listings : [],
    meta: data.meta ?? null,
  }
}
