'use client'

import { useMemo } from 'react'
import { BentoGallery } from '@/components/listing/BentoGallery'
import { getListingDisplayImageUrls } from '@/lib/listing-display-images'

export function ListingGallery({ listing, language, onImageClick }) {
  const displayUrls = useMemo(() => getListingDisplayImageUrls(listing), [listing])
  if (displayUrls.length === 0) return null
  return (
    <BentoGallery
      images={displayUrls}
      title={listing?.title || ''}
      language={language}
      onImageClick={onImageClick}
    />
  )
}
