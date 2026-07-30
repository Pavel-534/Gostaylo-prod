/**
 * Server-rendered PDP gate screens — moderation / not found.
 * Stage 171.24 (PR-4) / 199.3 — One Surface CTAs via StorefrontStateView.
 */

import { getUIText } from '@/lib/translations'
import { StorefrontStateView } from '@/components/product/StorefrontStateView'

/**
 * @param {{ lang?: string }} props
 */
export function ListingPdpModerationView({ lang = 'ru' }) {
  return (
    <StorefrontStateView
      variant="inbox"
      testId="listing-pdp-moderation"
      className="min-h-screen bg-slate-50"
      title={getUIText('listingDetail_underModeration', lang)}
      body={getUIText('listingDetail_underModerationDesc', lang)}
      primaryLabel={getUIText('listingDetail_backToListings', lang)}
      primaryHref="/listings"
    />
  )
}

/**
 * @param {{ lang?: string }} props
 */
export function ListingPdpNotFoundView({ lang = 'ru' }) {
  return (
    <StorefrontStateView
      variant="empty"
      testId="listing-pdp-not-found"
      className="min-h-screen bg-slate-50"
      title={getUIText('listingDetail_notFound', lang)}
      body={getUIText('listingDetail_notFoundHint', lang)}
      primaryLabel={getUIText('listingDetail_backToListings', lang)}
      primaryHref="/listings"
    />
  )
}
