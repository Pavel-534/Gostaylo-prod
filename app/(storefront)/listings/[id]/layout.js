/**
 * Listing Detail Layout — metadata + JSON-LD.
 * Stage 171.30 (P0.5) — unified PDP bootstrap (one listings SELECT with page).
 */

import { cookies, headers } from 'next/headers'
import { getLangFromRequest } from '@/lib/translations'
import { getRequestSiteUrl } from '@/lib/server-site-url'
import { getCachedListingPdpBootstrap } from '@/lib/listing/get-cached-listing-pdp-bootstrap.js'
import ListingSchema from '@/components/seo/ListingSchema'
import { getCommissionRate } from '@/lib/commission/get-commission-rate-server.js'
import { isSocialPreviewCrawler } from '@/lib/seo/social-crawler-gate'
import { resolveListingPublicGuestAccess } from '@/lib/listing/listing-public-guest-gate'
import {
  buildListingDetailOgMetadata,
  buildListingModerationStubOgMetadata,
  buildListingNotFoundOgMetadata,
  resolveListingOgCurrency,
} from '@/lib/seo/build-listing-og-metadata'

export async function generateMetadata({ params }) {
  const { id } = await params
  const listingId = String(id || '').trim()
  const headersList = await headers()
  const cookieStore = await cookies()
  const lang = getLangFromRequest(cookieStore, headersList)
  const baseUrl = await getRequestSiteUrl()
  const bootstrap = await getCachedListingPdpBootstrap(listingId)
  const listing = bootstrap.layoutRow
  const isCrawler = isSocialPreviewCrawler(headersList.get('user-agent'))

  if (!listing) {
    return buildListingNotFoundOgMetadata(lang, baseUrl)
  }

  const access = resolveListingPublicGuestAccess({
    listing,
    isSocialCrawler: isCrawler,
  })

  if (!access.allowed) {
    if (access.code === 'LISTING_UNDER_MODERATION') {
      return buildListingModerationStubOgMetadata(lang, baseUrl)
    }
    return buildListingNotFoundOgMetadata(lang, baseUrl)
  }

  const currency = resolveListingOgCurrency(cookieStore)
  return buildListingDetailOgMetadata({
    listing,
    lang,
    baseUrl,
    listingId,
    currency,
  })
}

export default async function ListingLayout({ children, params }) {
  const { id } = await params
  const listingId = String(id || '').trim()
  const bootstrap = await getCachedListingPdpBootstrap(listingId)
  let listingForSchema = bootstrap.activeLayoutRow

  if (listingForSchema) {
    const { guestServiceFeePercent } = await getCommissionRate()
    listingForSchema = {
      ...listingForSchema,
      guest_service_fee_percent: guestServiceFeePercent,
    }
  }

  return (
    <>
      {listingForSchema ? <ListingSchema listing={listingForSchema} /> : null}
      {children}
    </>
  )
}
