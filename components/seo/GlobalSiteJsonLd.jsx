/**
 * Серверный глобальный JSON-LD: WebSite + SearchAction (`semantic=1`).
 * Stage 86.0 + 87.0 — локаль через **`getLangFromRequest`** → **`inLanguage`** + **`description`**.
 */
import { cookies, headers } from 'next/headers'
import { getRequestSiteUrl } from '@/lib/server-site-url'
import { getSiteDisplayName } from '@/lib/site-url'
import { buildWebSiteSearchActionJsonLd } from '@/lib/seo/site-website-schema'
import { getLangFromRequest } from '@/lib/translations'

export default async function GlobalSiteJsonLd() {
  const cookieStore = await cookies()
  const headersList = await headers()
  const lang = getLangFromRequest(cookieStore, headersList)
  const baseUrl = await getRequestSiteUrl()
  const schema = buildWebSiteSearchActionJsonLd(baseUrl, getSiteDisplayName(), lang)
  const json = JSON.stringify(schema).replace(/</g, '\\u003c')

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
  )
}
