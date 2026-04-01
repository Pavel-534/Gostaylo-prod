/**
 * ItemList JSON-LD для каталога /listings (первые N результатов под текущий query).
 */
import { getRequestSiteUrl } from '@/lib/server-site-url'
import { getPublicSiteUrl } from '@/lib/site-url'
import { fetchListingsForCatalogItemList } from '@/lib/seo/listings-catalog-itemlist'

export default async function ListingsCatalogItemListSchema({ searchParams }) {
  let baseUrl
  try {
    baseUrl = await getRequestSiteUrl()
  } catch {
    baseUrl = getPublicSiteUrl()
  }
  const origin = baseUrl.replace(/\/$/, '')

  const listings = await fetchListingsForCatalogItemList(searchParams)
  if (!listings.length) return null

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: listings.length,
    itemListElement: listings.map((l, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${origin}/listings/${l.id}/`,
      name: l.title || `Listing ${l.id}`,
    })),
  }

  const json = JSON.stringify(schema).replace(/</g, '\\u003c')

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: json }}
    />
  )
}
