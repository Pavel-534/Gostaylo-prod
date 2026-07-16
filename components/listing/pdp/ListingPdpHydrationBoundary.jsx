'use client'

/**
 * Client bridge: server-dehydrated TanStack Query cache → PDP composer.
 * Stage 171.24 (PR-2) — infrastructure only; RSC `page.js` wires this in PR-4.
 *
 * @see lib/query-prefetch/prefetch-listing-pdp-queries.js
 * @see lib/listing/get-cached-listing-pdp-bootstrap.js
 */

import { HydrationBoundary } from '@tanstack/react-query'
import { ListingPdpClient } from '@/app/(storefront)/listings/[id]/ListingPdpClient'

/**
 * @param {object} props
 * @param {import('@tanstack/react-query').DehydratedState} props.state — from `buildListingPdpDehydratedState`
 * @param {string} [props.listingId]
 * @param {string} [props.lang]
 * @param {{ id: string }} [props.params]
 */
export function ListingPdpHydrationBoundary({ state, ...clientProps }) {
  return (
    <HydrationBoundary state={state}>
      <ListingPdpClient {...clientProps} />
    </HydrationBoundary>
  )
}
