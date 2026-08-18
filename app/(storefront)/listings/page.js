import ListingsCatalogItemListSchema from '@/components/seo/ListingsCatalogItemListSchema'
import { buildListingsCatalogMetadata } from '@/lib/seo/listings-catalog-metadata'
import { getCatalogBootstrapFromSearchParams } from '@/lib/listing/get-cached-catalog-bootstrap.js'
import { buildCatalogDehydratedState } from '@/lib/query-prefetch/prefetch-catalog-queries'
import { CatalogHydrationBoundary } from '@/components/catalog/CatalogHydrationBoundary'
import ListingsCatalogClient from './listings-catalog-client'
import { ListingsCatalogSkeleton } from '@/components/listings-catalog-skeleton'
import { Suspense } from 'react'

/** Stage 87.0 / 201.104 — metadata must not await catalog search (blocks Search tab). */
export async function generateMetadata({ searchParams }) {
  return buildListingsCatalogMetadata(searchParams, null, { skipHeavyBootstrap: true })
}

async function ListingsCatalogRscBody({ searchParams }) {
  const bootstrap = await getCatalogBootstrapFromSearchParams(searchParams)
  const dehydratedState = await buildCatalogDehydratedState(bootstrap)

  return (
    <>
      <ListingsCatalogItemListSchema bootstrap={bootstrap} />
      <CatalogHydrationBoundary state={dehydratedState}>
        <ListingsCatalogClient />
      </CatalogHydrationBoundary>
    </>
  )
}

export default function ListingsPage({ searchParams }) {
  return (
    <Suspense fallback={<ListingsCatalogSkeleton />}>
      <ListingsCatalogRscBody searchParams={searchParams} />
    </Suspense>
  )
}
