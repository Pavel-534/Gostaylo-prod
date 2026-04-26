/**
 * Metadata API для каталога /listings
 */
import { cookies, headers } from 'next/headers'
import { getLangFromRequest } from '@/lib/translations'
import { getRequestSiteUrl } from '@/lib/server-site-url'
import { getPublicSiteUrl, getSiteDisplayName } from '@/lib/site-url'
import {
  getListingsCatalogTitleAndDescriptionWithRows,
  buildListingsAbsoluteCanonical,
} from '@/lib/seo/listings-catalog-seo'
import { fetchCategoriesSeoSnapshot } from '@/lib/seo/listings-catalog-categories-snapshot'
import { fetchListingsCountForCatalogSeo } from '@/lib/seo/listings-catalog-listing-count'

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
  const [catRows, listingCount] = await Promise.all([
    fetchCategoriesSeoSnapshot(),
    fetchListingsCountForCatalogSeo(searchParams),
  ])
  const { title, description } = getListingsCatalogTitleAndDescriptionWithRows(
    lang,
    searchParams,
    catRows,
    listingCount,
  )
  const canonical = buildListingsAbsoluteCanonical(baseUrl, searchParams)

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: getSiteDisplayName(),
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}
