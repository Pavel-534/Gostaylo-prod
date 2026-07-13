'use client'

import { useMemo } from 'react'
import { ListingCard } from '@/components/listing-card'
import { useListingWizard } from '../../context/ListingWizardContext'
import { useStorefrontDisplayFx } from '@/lib/hooks/use-storefront-display-fx'

const PREVIEW_PLACEHOLDER_IMAGE = 'https://placehold.co/600x400/e2e8f0/64748b?text=No+Image'

/**
 * SSOT live preview listing payload for panel + mobile sheet.
 */
export function useWizardPreviewListing() {
  const { t, formData, listingCategorySlug, pricingPreview } = useListingWizard()

  return useMemo(
    () => ({
      id: 'preview',
      title: formData.title || t('previewTitlePlaceholder'),
      district: formData.district || t('previewDistrictPlaceholder'),
      categorySlug: listingCategorySlug,
      category: { slug: listingCategorySlug },
      basePriceThb: parseFloat(String(formData.basePriceThb)) || 0,
      base_price_thb: parseFloat(String(formData.basePriceThb)) || 0,
      guestDisplayPriceThb:
        pricingPreview?.storefrontGuestDisplayThb ??
        pricingPreview?.sitePriceSameCurrency ??
        0,
      coverImage: formData.images[0] || PREVIEW_PLACEHOLDER_IMAGE,
      cover_image: formData.images[0] || PREVIEW_PLACEHOLDER_IMAGE,
      images: formData.images.length > 0 ? formData.images : [PREVIEW_PLACEHOLDER_IMAGE],
      rating: 0,
      reviewsCount: 0,
      reviews_count: 0,
      metadata: formData.metadata,
      isFeatured: false,
      is_featured: false,
    }),
    [formData, listingCategorySlug, pricingPreview, t],
  )
}

/**
 * ListingCard + guest-facing hint — shared by desktop panel and mobile sheet.
 */
export function ListingWizardPreviewContent({ showHints = true }) {
  const { t, language } = useListingWizard()
  const listing = useWizardPreviewListing()
  const { currency, exchangeRates } = useStorefrontDisplayFx()

  return (
    <>
      <ListingCard
        listing={listing}
        currency={currency}
        language={language}
        exchangeRates={exchangeRates}
        onFavorite={() => {}}
        isFavorited={false}
      />
      {showHints ? (
        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/90 p-3 text-xs leading-relaxed text-slate-600">
          <p className="mb-1 font-medium text-slate-700">{t('thisIsHowGuestsSee')}</p>
          <p>{t('continueFilling')}</p>
        </div>
      ) : null}
    </>
  )
}
