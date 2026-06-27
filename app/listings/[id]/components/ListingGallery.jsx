'use client'

import { useMemo } from 'react'
import { BentoGallery } from '@/components/listing/BentoGallery'
import { ListingGalleryEmptyFallback } from '@/components/listing/ListingGalleryEmptyFallback'
import {
  getPdpHeroImageUrls,
  resolvePdpHeroBlurDataURL,
} from '@/lib/media/image-delivery'

export function ListingGallery({ listing, language, onImageClick }) {
  const heroUrls = useMemo(() => getPdpHeroImageUrls(listing), [listing])
  const blurDataURL = useMemo(() => resolvePdpHeroBlurDataURL(listing), [listing])

  if (heroUrls.length === 0) {
    return <ListingGalleryEmptyFallback language={language} />
  }

  return (
    <BentoGallery
      images={heroUrls}
      listingId={listing?.id}
      title={listing?.title || ''}
      language={language}
      onImageClick={onImageClick}
      blurDataURL={blurDataURL}
    />
  )
}
