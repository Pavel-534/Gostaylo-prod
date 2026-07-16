/**
 * Server-rendered PDP gate screens — moderation / not found.
 * Stage 171.24 (PR-4) — returned from RSC `page.js` before client hydrate.
 */

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'

/**
 * @param {{ lang?: string }} props
 */
export function ListingPdpModerationView({ lang = 'ru' }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center max-w-md px-6">
        <h2 className="text-2xl font-semibold mb-2">
          {getUIText('listingDetail_underModeration', lang)}
        </h2>
        <p className="text-slate-600 mb-6">
          {getUIText('listingDetail_underModerationDesc', lang)}
        </p>
        <Button asChild variant="outline">
          <Link href="/listings">{getUIText('listingDetail_backToListings', lang)}</Link>
        </Button>
      </div>
    </div>
  )
}

/**
 * @param {{ lang?: string }} props
 */
export function ListingPdpNotFoundView({ lang = 'ru' }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-2">
          {getUIText('listingDetail_notFound', lang)}
        </h2>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/listings">{getUIText('listingDetail_backToListings', lang)}</Link>
        </Button>
      </div>
    </div>
  )
}
