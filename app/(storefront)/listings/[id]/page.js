/**
 * PDP RSC shell — server bootstrap + TanStack Query dehydrate + client composer.
 * Stage 171.24 (PR-4) — listing detail loaded once on server; client hydrates without
 * `GET /api/v2/listings/[id]` on cold load.
 * Stage 201.101 — stream bootstrap behind Suspense; instant chrome from catalog cache.
 *
 * Client islands (unchanged): booking, calendar, chat — `ListingPdpClient.jsx`.
 */

import { Suspense } from 'react'
import { cookies, headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getLangFromRequest } from '@/lib/translations'
import { getCachedListingPdpBootstrap } from '@/lib/listing/get-cached-listing-pdp-bootstrap.js'
import { buildListingPdpDehydratedState } from '@/lib/query-prefetch/prefetch-listing-pdp-queries'
import { ListingPdpHydrationBoundary } from '@/components/listing/pdp/ListingPdpHydrationBoundary'
import { ListingPdpInstantShell } from '@/components/listing/pdp/ListingPdpInstantShell'
import { ListingPdpModerationView } from './ListingPdpGateViews'

async function ListingPdpRscBody({ listingId }) {
  const headersList = await headers()
  const cookieStore = await cookies()
  const lang = getLangFromRequest(cookieStore, headersList)

  const bootstrap = await getCachedListingPdpBootstrap(listingId)

  if (bootstrap.kind === 'moderation') {
    return <ListingPdpModerationView lang={lang} />
  }

  // Stage 200.71 — true HTTP 404 (no indexable soft-404)
  if (bootstrap.kind === 'not_found') {
    notFound()
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

export default async function ListingDetailPage({ params }) {
  const { id } = await params
  const listingId = String(id || '').trim()

  return (
    <Suspense fallback={<ListingPdpInstantShell listingId={listingId} />}>
      <ListingPdpRscBody listingId={listingId} />
    </Suspense>
  )
}
