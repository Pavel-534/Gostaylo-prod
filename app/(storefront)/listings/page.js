import ListingsCatalogItemListSchema from '@/components/seo/ListingsCatalogItemListSchema'
import { buildListingsCatalogMetadata } from '@/lib/seo/listings-catalog-metadata'
import { getCatalogBootstrapFromSearchParams } from '@/lib/listing/get-cached-catalog-bootstrap.js'
import { buildCatalogDehydratedState } from '@/lib/query-prefetch/prefetch-catalog-queries'
import { CatalogHydrationBoundary } from '@/components/catalog/CatalogHydrationBoundary'

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
      <CatalogHydrationBoundary state={dehydratedState} />
    </>
  )
}
