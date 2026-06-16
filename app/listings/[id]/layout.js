/**
 * GoStayLo - Listing Detail Layout
 * Stage 149.2 — OG Guest-Gate: crawlers get full OG on PENDING; guests get moderation stub.
 */

import { cookies, headers } from 'next/headers'
import { getLangFromRequest } from '@/lib/translations'
import { getRequestSiteUrl } from '@/lib/server-site-url'
import {
  getCachedActiveListingForLayout,
  getCachedListingForGuestGate,
} from '@/lib/seo/listing-layout-data'
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
  const headersList = await headers()
  const cookieStore = await cookies()
  const lang = getLangFromRequest(cookieStore, headersList)
  const baseUrl = await getRequestSiteUrl()
  const listing = await getCachedListingForGuestGate(params.id)
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
    listingId: params.id,
    currency,
  })
}

export default async function ListingLayout({ children, params }) {
  const listing = await getCachedActiveListingForLayout(params.id)
  let listingForSchema = listing
  if (listing) {
    const { guestServiceFeePercent } = await getCommissionRate()
    listingForSchema = {
      ...listing,
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
