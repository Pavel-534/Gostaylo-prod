/**
 * Server-side home featured grid — same contract as `fetchHomeFeatured` (no HTTP hop).
 * Stage 171.27
 */

import { runListingsSearchGet } from '@/lib/api/run-listings-search-get'
import { getPublicSiteUrl } from '@/lib/site-url'

/**
 * @param {ReturnType<typeof import('@/lib/home/fetch-home-featured').buildHomeFeaturedKeyParams>} keyParams
 */
function homeFeaturedKeyParamsToUrlSearchParams(keyParams) {
  const params = new URLSearchParams({ limit: '12', featured: 'true' })
  params.set('softAvailability', '0')
  if (keyParams.category) params.set('category', keyParams.category)
  if (keyParams.where) params.set('where', keyParams.where)
  if (keyParams.checkIn) params.set('checkIn', keyParams.checkIn)
  if (keyParams.checkOut) params.set('checkOut', keyParams.checkOut)
  if (keyParams.checkInTime) params.set('checkInTime', keyParams.checkInTime)
  if (keyParams.checkOutTime) params.set('checkOutTime', keyParams.checkOutTime)
  if (keyParams.guests) params.set('guests', keyParams.guests)
  if (keyParams.q) {
    params.set('q', keyParams.q)
    if (keyParams.semantic === '1') params.set('semantic', '1')
  }
  return params
}

/**
 * @param {ReturnType<typeof import('@/lib/home/fetch-home-featured').buildHomeFeaturedKeyParams>} keyParams
 * @returns {Promise<{ listings: object[], available: number }>}
 */
export async function fetchHomeFeaturedServer(keyParams) {
  const urlParams = homeFeaturedKeyParamsToUrlSearchParams(keyParams)
  const origin = getPublicSiteUrl().replace(/\/$/, '')
  const internalUrl = `${origin}/api/v2/search?${urlParams.toString()}`
  const res = await runListingsSearchGet(new Request(internalUrl), {
    skipRateLimit: true,
    isLite: true,
  })

  if (!res.ok) {
    return { listings: [], available: 0 }
  }

  try {
    const json = await res.json()
    if (!json.success) return { listings: [], available: 0 }
    return {
      listings: Array.isArray(json.data?.listings) ? json.data.listings : [],
      available: Number(json.data?.meta?.available ?? 0),
    }
  } catch {
    return { listings: [], available: 0 }
  }
}
