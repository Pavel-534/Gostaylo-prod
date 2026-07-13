'use client'

import { memo, useMemo } from 'react'
import { Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ListingCard } from '@/components/listing-card'
import { ListingPublishQualityChecklist } from '@/components/partner/listing/ListingPublishQualityChecklist'
import { WizardPartnerEarningsCalculator } from '@/components/partner/wizard/WizardPartnerEarningsCalculator'
import { useListingWizard } from '../context/ListingWizardContext'
import {
  WIZARD_STEP_ROOT_CLASS,
  WIZARD_STEP_SUBTITLE_CLASS,
  WIZARD_STEP_TITLE_CLASS,
} from './wizard-step-layout'
import { useStorefrontDisplayFx } from '@/lib/hooks/use-storefront-display-fx'

function StepPreviewInner() {
  const w = useListingWizard()
  const {
    t,
    tr,
    formData,
    language,
    listingCategorySlug,
    partnerCommissionRate,
    transportWizard,
    toursWizard,
    canProceed,
    publishQualityChecklist,
    pricingPreview,
  } = w
  const { currency, exchangeRates } = useStorefrontDisplayFx()

  const periodLabel = useMemo(() => {
    if (transportWizard) return t('wizardPriceCalcPeriodBookingDay')
    if (toursWizard) return t('wizardPriceCalcPeriodTour')
    return t('wizardPriceCalcPeriodNight')
  }, [transportWizard, toursWizard, t])

  return (
    <div className={WIZARD_STEP_ROOT_CLASS}>
      <div>
        <h2 className={`mb-2 ${WIZARD_STEP_TITLE_CLASS}`}>{t('livePreview')}</h2>
        <p className={WIZARD_STEP_SUBTITLE_CLASS}>{t('listingQuality_previewHint', t('continueFilling'))}</p>
      </div>

      <ListingPublishQualityChecklist checklist={publishQualityChecklist} t={t} />

      {parseFloat(String(formData.basePriceThb)) > 0 ? (
        <WizardPartnerEarningsCalculator
          t={t}
          tr={tr}
          baseAmount={formData.basePriceThb}
          baseCurrency={formData.baseCurrency || 'THB'}
          hostCommissionPercent={partnerCommissionRate ?? 0}
          periodLabel={periodLabel}
        />
      ) : null}

      <div className="flex gap-3 rounded-2xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm text-slate-700 leading-relaxed">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-brand" aria-hidden />
        <p>{t('wizardModerationBanner')}</p>
      </div>

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
            currency={currency}
            language={language}
            exchangeRates={exchangeRates}
            onFavorite={() => {}}
            isFavorited={false}
          />
        </CardContent>
      </Card>
    </div>
  )
}

export const StepPreview = memo(StepPreviewInner)
