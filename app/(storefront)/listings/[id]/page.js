/**
 * PDP RSC shell — server bootstrap + TanStack Query dehydrate + client composer.
 * Stage 171.24 (PR-4) — listing detail loaded once on server; client hydrates without
 * `GET /api/v2/listings/[id]` on cold load.
 *
 * Client islands (unchanged): booking, calendar, chat — `ListingPdpClient.jsx`.
 */

import { cookies, headers } from 'next/headers'
import { getLangFromRequest } from '@/lib/translations'
import { getCachedListingPdpBootstrap } from '@/lib/listing/get-cached-listing-pdp-bootstrap.js'
import { buildListingPdpDehydratedState } from '@/lib/query-prefetch/prefetch-listing-pdp-queries'
import { ListingPdpHydrationBoundary } from '@/components/listing/pdp/ListingPdpHydrationBoundary'
import {
  ListingPdpModerationView,
  ListingPdpNotFoundView,
} from './ListingPdpGateViews'

export default async function ListingDetailPage({ params }) {
  const { id } = await params
  const listingId = String(id || '').trim()

  const headersList = await headers()
  const cookieStore = await cookies()
  const lang = getLangFromRequest(cookieStore, headersList)

  const bootstrap = await getCachedListingPdpBootstrap(listingId)

  if (bootstrap.kind === 'moderation') {
    return <ListingPdpModerationView lang={lang} />
  }

  if (bootstrap.kind === 'not_found') {
    return <ListingPdpNotFoundView lang={lang} />
  }

  const dehydratedState = await buildListingPdpDehydratedState(listingId, bootstrap.listing)

  return (
    <ListingPdpHydrationBoundary
      state={dehydratedState}
      listingId={listingId}
      lang={lang}
    />
  )
}
