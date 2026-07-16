/**
 * ItemList JSON-LD для каталога /listings (первые N результатов под текущий query).
 */
import { getRequestSiteUrl } from '@/lib/server-site-url'
import { getPublicSiteUrl } from '@/lib/site-url'
import { getCatalogBootstrapFromSearchParams } from '@/lib/listing/get-cached-catalog-bootstrap.js'

/**
 * @param {object} props
 * @param {import('@/lib/listing/get-cached-catalog-bootstrap.js').CatalogBootstrapResult} [props.bootstrap]
 * @param {import('next').SearchParams | Record<string, string | string[] | undefined>} [props.searchParams]
 */
export default async function ListingsCatalogItemListSchema({ bootstrap, searchParams }) {
  let baseUrl
  try {
    baseUrl = await getRequestSiteUrl()
  } catch {
    baseUrl = getPublicSiteUrl()
  }
  const origin = baseUrl.replace(/\/$/, '')

  const boot =
    bootstrap ??
    (searchParams != null ? await getCatalogBootstrapFromSearchParams(searchParams) : null)
  const listings = boot?.itemListListings ?? []
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
