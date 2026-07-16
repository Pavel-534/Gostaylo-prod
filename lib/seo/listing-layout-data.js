/**
 * Layout listing accessors — delegate to unified PDP bootstrap (Stage 171.30 P0.5).
 * @see lib/listing/get-cached-listing-pdp-bootstrap.js
 */
import { cache } from 'react'
import { getCachedListingPdpBootstrap } from '@/lib/listing/get-cached-listing-pdp-bootstrap.js'

/** ACTIVE or PENDING (non-draft) — OG Guest-Gate SSOT. */
export const getCachedListingForGuestGate = cache(async (id) => {
  const bootstrap = await getCachedListingPdpBootstrap(String(id || '').trim())
  return bootstrap.layoutRow ?? null
})

/** ACTIVE only — catalog JSON-LD. */
export const getCachedActiveListingForLayout = cache(async (id) => {
  const bootstrap = await getCachedListingPdpBootstrap(String(id || '').trim())
  return bootstrap.activeLayoutRow ?? null
})
