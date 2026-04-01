import ListingsCatalogClient from './listings-catalog-client'
import ListingsCatalogItemListSchema from '@/components/seo/ListingsCatalogItemListSchema'
import { buildListingsCatalogMetadata } from '@/lib/seo/listings-catalog-metadata'

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
