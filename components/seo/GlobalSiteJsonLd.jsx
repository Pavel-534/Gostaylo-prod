/**
 * Серверный глобальный JSON-LD: WebSite + SearchAction (`semantic=1`).
 * Stage 86.0
 */
import { getRequestSiteUrl } from '@/lib/server-site-url'
import { getSiteDisplayName } from '@/lib/site-url'
import { buildWebSiteSearchActionJsonLd } from '@/lib/seo/site-website-schema'

export default async function GlobalSiteJsonLd() {
  const baseUrl = await getRequestSiteUrl()
  const schema = buildWebSiteSearchActionJsonLd(baseUrl, getSiteDisplayName())
  const json = JSON.stringify(schema).replace(/</g, '\\u003c')

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
  )
}
