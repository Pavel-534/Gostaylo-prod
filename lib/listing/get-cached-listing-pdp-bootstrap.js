/**

 * RSC bootstrap SSOT for PDP — deduped per request via `React.cache`.

 * Stage 171.24 (PR-4) + 171.30 (P0.5) — one listings SELECT for layout + page.

 *

 * Flow:

 * 1. Session (`getSessionPayload`)

 * 2. Single DB row (`fetchPublicListingDbRow`)

 * 3. Layout subset (`mapListingLayoutRowFromDbRow`) — metadata / JSON-LD

 * 4. Full DTO when guest-gate passes (`buildPublicListingDetailFromDbRow`, views +1 once)

 *

 * Dev smoke: `lib/query-prefetch/debug-listing-pdp-prefetch.js`.

 */



import { cache } from 'react'

import { getSessionPayload } from '@/lib/services/session-service'

import {

  fetchPublicListingDbRow,

  buildPublicListingDetailFromDbRow,

} from '@/lib/listing/get-public-listing-detail.js'

import {

  getActiveListingLayoutRowForSchema,

  mapListingLayoutRowFromDbRow,

} from '@/lib/listing/map-listing-layout-row.js'

import { mapListingDetailFromApi } from '@/lib/catalog/map-listing-detail-api'



/**

 * @typedef {'ok' | 'moderation' | 'not_found'} ListingPdpBootstrapKind

 */



/**

 * @typedef {Object} ListingPdpBootstrapBase

 * @property {ListingPdpBootstrapKind} kind

 * @property {ReturnType<typeof mapListingLayoutRowFromDbRow>} layoutRow — OG/metadata (ACTIVE|PENDING)

 * @property {ReturnType<typeof getActiveListingLayoutRowForSchema>} activeLayoutRow — JSON-LD (ACTIVE only)

 */



/**

 * @typedef {ListingPdpBootstrapBase & { kind: 'ok', listing: ReturnType<typeof mapListingDetailFromApi>, raw: object }} ListingPdpBootstrapOk

 * @typedef {ListingPdpBootstrapBase & { kind: 'moderation' }} ListingPdpBootstrapModeration

 * @typedef {ListingPdpBootstrapBase & { kind: 'not_found' }} ListingPdpBootstrapNotFound

 */



/** @typedef {ListingPdpBootstrapOk | ListingPdpBootstrapModeration | ListingPdpBootstrapNotFound} ListingPdpBootstrapResult */



async function loadListingPdpBootstrap(listingId) {

  const id = String(listingId || '').trim()

  const emptyLayout = { layoutRow: null, activeLayoutRow: null }



  if (!id) {

    return { kind: 'not_found', ...emptyLayout }

  }



  const dbRow = await fetchPublicListingDbRow(id)

  if (!dbRow) {

    return { kind: 'not_found', ...emptyLayout }

  }



  const layoutRow = mapListingLayoutRowFromDbRow(dbRow)

  const activeLayoutRow = getActiveListingLayoutRowForSchema(layoutRow)



  const session = await getSessionPayload()

  const viewerId = session?.userId != null ? String(session.userId) : null

  const viewerRole = session?.role != null ? String(session.role) : null



  const result = await buildPublicListingDetailFromDbRow({

    listing: dbRow,

    listingId: id,

    viewerId,

    viewerRole,

    incrementViews: true,

  })



  if (!result.ok && result.code === 'LISTING_UNDER_MODERATION') {

    return { kind: 'moderation', layoutRow, activeLayoutRow: null }

  }



  if (!result.ok) {

    return { kind: 'not_found', layoutRow, activeLayoutRow: null }

  }



  const listing = mapListingDetailFromApi(result.data)

  if (!listing) {

    return { kind: 'not_found', layoutRow, activeLayoutRow: null }

  }



  return {

    kind: 'ok',

    listing,

    raw: result.data,

    layoutRow,

    activeLayoutRow,

  }

}



/**

 * Unified PDP request cache — layout metadata, JSON-LD, and page bootstrap.

 * Alias: `getCachedListingForLayoutAndPage`.

 *

 * @param {string} listingId

 * @returns {Promise<ListingPdpBootstrapResult>}

 */

export const getCachedListingPdpBootstrap = cache(loadListingPdpBootstrap)



/** @deprecated Use `getCachedListingPdpBootstrap` — kept as explicit alias (P0.5). */

export const getCachedListingForLayoutAndPage = getCachedListingPdpBootstrap


