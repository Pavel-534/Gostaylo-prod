import ListingsCatalogClient from './listings-catalog-client'
import ListingsCatalogItemListSchema from '@/components/seo/ListingsCatalogItemListSchema'
import { buildListingsCatalogMetadata } from '@/lib/seo/listings-catalog-metadata'

/** Stage 87.0 — title/description: **`buildListingsCatalogMetadata`** → **`getListingsCatalogTitleAndDescriptionWithRows`** + **`getCategoryDisplayName`** / **`catalogSeo_*`** ({categoryName}, {location}, {brand}). */
export async function generateMetadata({ searchParams }) {
  return buildListingsCatalogMetadata(searchParams)
}

export default async function ListingsPage({ searchParams }) {
  return (
    <>
      <ListingsCatalogItemListSchema searchParams={searchParams} />
      <ListingsCatalogClient />
    </>
  )
}
