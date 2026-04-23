'use client'

import { memo } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { GostayloListingCard } from '@/components/gostaylo-listing-card'
import { useListingWizard } from '../context/ListingWizardContext'

function StepPreviewInner() {
  const w = useListingWizard()
  const { t, formData, language, listingCategorySlug, canProceed, getCategoryName } = w
  const name = getCategoryName(listingCategorySlug) || formData.categoryName
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-2xl font-semibold">{t('livePreview')}</h2>
        <p className="text-slate-600">{t('continueFilling')}</p>
      </div>
      <ul className="space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-sm text-slate-700">
        <li className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <span>
            {t('listingTitleLabel')}: {formData.title ? `${formData.title.slice(0, 40)}${formData.title.length > 40 ? '…' : ''}` : '—'}
          </span>
        </li>
        <li className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <span>
            {t('selectCategory')}: {name || '—'}
          </span>
        </li>
        <li className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <span>
            {t('location')}: {formData.district || '—'}
          </span>
        </li>
        <li className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <span>
            {t('gallery')}: {formData.images?.length || 0}
          </span>
        </li>
        <li className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <span>
            {t('pricing')}: ฿{Number(formData.basePriceThb) || 0}
          </span>
        </li>
      </ul>
      {!canProceed && (
        <p className="text-sm text-amber-700">{t('continueFilling')}</p>
      )}
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <GostayloListingCard
            listing={{
              id: 'preview',
              title: formData.title || t('previewTitlePlaceholder'),
              district: formData.district || t('previewDistrictPlaceholder'),
              categorySlug: listingCategorySlug,
              category: { slug: listingCategorySlug },
              basePriceThb: parseFloat(String(formData.basePriceThb)) || 0,
              base_price_thb: parseFloat(String(formData.basePriceThb)) || 0,
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
