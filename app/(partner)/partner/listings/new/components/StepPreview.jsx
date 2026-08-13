'use client'

import { memo, useMemo } from 'react'
import { Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ListingCard } from '@/components/listing-card'
import { ListingPublishQualityChecklist } from '@/components/partner/listing/ListingPublishQualityChecklist'
import { ListingHealthScoreWidget } from '@/components/partner/listing/ListingHealthScoreWidget'
import { WizardPartnerEarningsCalculator } from '@/components/partner/wizard/WizardPartnerEarningsCalculator'
import { PartnerSectionDivider } from '@/components/partner/PartnerSectionDivider'
import { PARTNER_SECTION_TITLE_CLASS } from '@/lib/ui/partner-section-rhythm'
import { useListingWizard } from '../context/ListingWizardContext'
import {
  WIZARD_STEP_ROOT_CLASS,
  WIZARD_STEP_TITLE_CLASS,
  WIZARD_MOBILE_FLAT_CARD_CLASS,
  WIZARD_MOBILE_FLAT_CARD_CONTENT_CLASS,
} from './wizard-step-layout'
import { useStorefrontDisplayFx } from '@/lib/hooks/use-storefront-display-fx'
import { cn } from '@/lib/utils'

function StepPreviewInner() {
  const w = useListingWizard()
  const {
    t,
    tr,
    formData,
    language,
    listingCategorySlug,
    listingCategoryWizardProfile,
    partnerCommissionRate,
    transportWizard,
    toursWizard,
    canProceed,
    canSoftPublish,
    canFullPublish,
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
        <h2 className={`mb-1 ${WIZARD_STEP_TITLE_CLASS}`}>{t('livePreview')}</h2>
        <p className="text-xs leading-relaxed text-slate-500">
          {t('listingQuality_previewHint', t('continueFilling'))}
        </p>
      </div>

      <section data-partner-section="preview-controls" className="space-y-4">
        <h3 className={PARTNER_SECTION_TITLE_CLASS}>{t('wizardSection_previewReview')}</h3>

        <ListingHealthScoreWidget
          formData={formData}
          t={t}
          wizardProfile={listingCategoryWizardProfile}
          categorySlug={listingCategorySlug}
          categoryName={formData.categoryName || ''}
          className="sm:hidden"
        />

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

        <div className="flex gap-3 rounded-2xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm leading-relaxed text-slate-700 max-sm:shadow-none">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
          <p>{t('wizardModerationBanner')}</p>
        </div>

        {!canFullPublish && canSoftPublish ? (
          <p className="text-sm text-slate-700">{t('listingQuality_softPublishHint')}</p>
        ) : null}
        {!canProceed && !canSoftPublish ? (
          <p className="text-sm text-amber-800">
            {t('listingQuality_publishBlocked', t('continueFilling'))}
          </p>
        ) : null}
      </section>

      <PartnerSectionDivider />

      <section data-partner-section="preview-card" className="space-y-3">
        <h3 className={PARTNER_SECTION_TITLE_CLASS}>{t('wizardSection_previewCard')}</h3>
        <Card className={cn(WIZARD_MOBILE_FLAT_CARD_CLASS, 'sm:border-slate-200 sm:bg-white')}>
          <CardContent className={cn(WIZARD_MOBILE_FLAT_CARD_CONTENT_CLASS, 'sm:p-5')}>
            <ListingCard
              listing={{
                id: 'preview',
                title: formData.title || t('previewTitlePlaceholder'),
                district: formData.district || t('previewDistrictPlaceholder'),
                categorySlug: listingCategorySlug,
                category: { slug: listingCategorySlug },
                basePriceThb: Number(pricingPreview?.base) || 0,
                base_price_thb: Number(pricingPreview?.base) || 0,
                baseCurrency: formData.baseCurrency || 'THB',
                base_currency: formData.baseCurrency || 'THB',
                basePriceAsset: {
                  amount: Number(formData.basePriceThb) || 0,
                  currency: String(formData.baseCurrency || 'THB').toUpperCase(),
                },
                sameCurrencyGuestNative: Number(pricingPreview?.storefrontInListingCurrency) || 0,
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
                metadata: {
                  ...(formData.metadata && typeof formData.metadata === 'object' ? formData.metadata : {}),
                  base_price_asset: {
                    amount: Number(formData.basePriceThb) || 0,
                    currency: String(formData.baseCurrency || 'THB').toUpperCase(),
                  },
                },
                isFeatured: false,
                is_featured: false,
              }}
              currency={currency}
              language={language}
              exchangeRates={exchangeRates}
              onFavorite={() => {}}
              isFavorited={false}
              layout="solo"
            />
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

export const StepPreview = memo(StepPreviewInner)
