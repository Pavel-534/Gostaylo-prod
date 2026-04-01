/**
 * Metadata API для каталога /listings
 */
import { cookies, headers } from 'next/headers'
import { getLangFromRequest } from '@/lib/translations'
import { getRequestSiteUrl } from '@/lib/server-site-url'
import { getPublicSiteUrl } from '@/lib/site-url'
import {
  getListingsCatalogTitleAndDescription,
  buildListingsAbsoluteCanonical,
} from '@/lib/seo/listings-catalog-seo'

export async function buildListingsCatalogMetadata(searchParams) {
  let baseUrl
  try {
    baseUrl = await getRequestSiteUrl()
  } catch {
    baseUrl = getPublicSiteUrl()
  }

  const cookieStore = await cookies()
  const headersList = await headers()
  const lang = getLangFromRequest(cookieStore, headersList)
  const { title, description } = getListingsCatalogTitleAndDescription(lang, searchParams)
  const canonical = buildListingsAbsoluteCanonical(baseUrl, searchParams)

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'Gostaylo',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}
