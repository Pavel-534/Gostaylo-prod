'use client'

/**
 * PDP hero band: gallery + flash/urgency (full content width).
 * Headline stays a separate export so the page can keep it inside the lg:col-span-2 column.
 */
import { ListingGallery } from '@/app/listings/[id]/components/ListingGallery'
import ListingHeader from '@/app/listings/[id]/components/ListingHeader'
import { UrgencyTimer } from '@/components/UrgencyTimer'
import { ListingFlashHotStrip } from '@/components/listing/ListingFlashHotStrip'
import { shouldShowFlashUrgencyTimerAboveStrip } from '@/lib/listing/flash-hot-strip'

export function ListingHeroGallery({ listing, language, onImageClick }) {
  return (
    <>
      <ListingGallery listing={listing} language={language} onImageClick={onImageClick} />

      {shouldShowFlashUrgencyTimerAboveStrip(
        listing.catalog_flash_urgency,
        listing.catalog_flash_social_proof,
      ) ? (
        <div className="mt-3 max-w-2xl">
          <UrgencyTimer endsAt={listing.catalog_flash_urgency.ends_at} language={language} />
        </div>
      ) : null}

      <ListingFlashHotStrip
        catalog_flash_urgency={listing.catalog_flash_urgency}
        catalog_flash_social_proof={listing.catalog_flash_social_proof}
        language={language}
        className="mt-2 max-w-2xl"
      />
    </>
  )
}

export function ListingHeroHeadline({ listing, language }) {
  return <ListingHeader listing={listing} language={language} />
}
