'use client'

/**
 * PDP: description + host (ListingInfo body), optional slot below body, amenities.
 */
import { Separator } from '@/components/ui/separator'
import { AmenitiesGrid } from '@/components/listing/AmenitiesGrid'
import AppListingDescription from '@/app/listings/[id]/components/ListingDescription'

export function ListingDescription({ listing, language, amenities = [], belowDescription = null }) {
  return (
    <>
      <AppListingDescription listing={listing} language={language} />
      {belowDescription}
      <Separator className="lg:hidden" />
      <AmenitiesGrid amenities={amenities} language={language} />
    </>
  )
}
