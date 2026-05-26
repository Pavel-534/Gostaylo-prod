'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ListingCard } from '@/components/listing-card'
import { ListingPublishQualityChecklist } from '@/components/partner/listing/ListingPublishQualityChecklist'
import { useListingWizard } from '../context/ListingWizardContext'

function StepPreviewInner() {
  const w = useListingWizard()
  const {
    t,
    formData,
    language,
    listingCategorySlug,
    canProceed,
    publishQualityChecklist,
    getCategoryName,
    pricingPreview,
  } = w
  const name = getCategoryName(listingCategorySlug) || formData.categoryName

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-2xl font-semibold">{t('livePreview')}</h2>
        <p className="text-slate-600">{t('listingQuality_previewHint', t('continueFilling'))}</p>
      </div>

      <ListingPublishQualityChecklist checklist={publishQualityChecklist} t={t} />

      {!canProceed && (
        <p className="text-sm text-amber-800">{t('listingQuality_publishBlocked', t('continueFilling'))}</p>
      )}

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <ListingCard
            listing={{
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
              coverImage: formData.images[0] || 'https://placehold.co/600x400/e2e8f0/64748b?text=No+Image',
              cover_image: formData.images[0] || 'https://placehold.co/600x400/e2e8f0/64748b?text=No+Image',
              images:
                formData.images.length > 0
                  ? formData.images
                  : ['https://placehold.co/600x400/e2e8f0/64748b?text=No+Image'],
              rating: 0,
              reviewsCount: 0,
              reviews_count: 0,
              metadata: formData.metadata,
              isFeatured: false,
              is_featured: false,
            }}
            currency="THB"
            language={language}
            exchangeRates={{ THB: 1 }}
            onFavorite={() => {}}
            isFavorited={false}
          />
        </CardContent>
      </Card>
    </div>
  )
}

export const StepPreview = memo(StepPreviewInner)
