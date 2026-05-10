/**
 * Серверный JSON-LD (Schema.org) для публичной карточки объявления.
 * Stage 63.0 + 86.0 — канон **`buildListingStructuredDataPayload`** (`@graph`: листинг + Breadcrumbs).
 */
import { getRequestSiteUrl } from '@/lib/server-site-url'
import { getCachedSitePhoneForSchema } from '@/lib/server/site-phone'
import { buildListingStructuredDataPayload } from '@/lib/seo/listing-schema-org.js'

/**
 * @param {{ listing: object | null }} props
 */
export default async function ListingSchema({ listing }) {
  if (!listing?.id) return null

  const baseUrl = await getRequestSiteUrl()
  const telephone = await getCachedSitePhoneForSchema()
  const schema = buildListingStructuredDataPayload(listing, baseUrl, telephone)
  const json = JSON.stringify(schema).replace(/</g, '\\u003c')

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
  )
}
