import ListingsCatalogItemListSchema from '@/components/seo/ListingsCatalogItemListSchema'
import { buildListingsCatalogMetadata } from '@/lib/seo/listings-catalog-metadata'
import { getCatalogBootstrapFromSearchParams } from '@/lib/listing/get-cached-catalog-bootstrap.js'
import { buildCatalogDehydratedState } from '@/lib/query-prefetch/prefetch-catalog-queries'
import { CatalogHydrationBoundary } from '@/components/catalog/CatalogHydrationBoundary'
import ListingsCatalogClient from './listings-catalog-client'
import { ListingsCatalogSkeleton } from '@/components/listings-catalog-skeleton'
import { Suspense } from 'react'

/** Stage 87.0 — title/description: **`buildListingsCatalogMetadata`** → shared catalog bootstrap. */
export async function generateMetadata({ searchParams }) {
  const bootstrap = await getCatalogBootstrapFromSearchParams(searchParams)
  return buildListingsCatalogMetadata(searchParams, bootstrap)
}

export default async function ListingsPage({ searchParams }) {
  const bootstrap = await getCatalogBootstrapFromSearchParams(searchParams)
  const dehydratedState = await buildCatalogDehydratedState(bootstrap)

  return (
    <>
      <ListingsCatalogItemListSchema bootstrap={bootstrap} />
      <Suspense fallback={<ListingsCatalogSkeleton />}>
        <CatalogHydrationBoundary state={dehydratedState}>
          <ListingsCatalogClient />
        </CatalogHydrationBoundary>
      </Suspense>
    </>
  )
}
