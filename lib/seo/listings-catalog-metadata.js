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
import { getCatalogBootstrapFromSearchParams } from '@/lib/listing/get-cached-catalog-bootstrap.js'
import { buildOgImageMetadata } from '@/lib/seo/resolve-og-image.js'

/**
 * @param {import('next').SearchParams | Record<string, string | string[] | undefined>} searchParams
 * @param {import('@/lib/listing/get-cached-catalog-bootstrap.js').CatalogBootstrapResult | null | undefined} [bootstrap]
 */
export async function buildListingsCatalogMetadata(searchParams, bootstrap = null) {
  let baseUrl
  try {
    baseUrl = await getRequestSiteUrl()
  } catch {
    baseUrl = getPublicSiteUrl()
  }

  const cookieStore = await cookies()
  const headersList = await headers()
  const lang = getLangFromRequest(cookieStore, headersList)

  const boot = bootstrap ?? (await getCatalogBootstrapFromSearchParams(searchParams))
  const catRows = boot?.categorySeoRows ?? (await fetchCategoriesSeoSnapshot())
  const listingCount =
    boot?.listingCountForSeo ?? (await fetchListingsCountForCatalogSeo(searchParams))

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
      images: buildOgImageMetadata(null, baseUrl, title),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: buildOgImageMetadata(null, baseUrl, title).map((i) => i.url),
    },
  }
}
