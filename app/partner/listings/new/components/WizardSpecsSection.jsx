'use client'

import { memo } from 'react'
import { Building2 } from 'lucide-react'
import { Label as UiLabel } from '@/components/ui/label'
import { Input as UiInput } from '@/components/ui/input'
import { Button as UiButton } from '@/components/ui/button'
import { useListingWizard } from '../context/ListingWizardContext'
import { clampIntFromDigits } from '@/lib/listing-wizard-numeric'
import { isTransportListingCategory } from '@/lib/listing-category-slug'
import { isPartnerListingHousingCategory } from '@/lib/partner/listing-wizard-metadata'
import { PartnerListingSearchMetadataFields } from '@/components/partner/PartnerListingSearchMetadataFields'

function SpecsFields() {
  const w = useListingWizard()
  const { formData, updateMetadata, t, getCategoryName, language, listingCategorySlug } = w
  const categoryName = formData.categoryName?.toLowerCase() || ''
  const slug = (listingCategorySlug || '').toLowerCase()

  if (slug === 'yachts' || categoryName.includes('yacht') || categoryName.includes('boat')) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <UiLabel className="text-sm font-medium text-slate-700">{t('fieldPassengers')}</UiLabel>
          <UiInput
            inputMode="numeric"
            autoComplete="off"
            value={String(formData.metadata.passengers)}
            onChange={(e) => updateMetadata('passengers', clampIntFromDigits(e.target.value, 1, 999, 1))}
            className="mt-2 h-11"
          />
        </div>
        <div>
          <UiLabel className="text-sm font-medium text-slate-700">{t('fieldEngineType')}</UiLabel>
          <UiInput
            type="text"
            placeholder={t('fieldEnginePlaceholder')}
            value={formData.metadata.engine}
            onChange={(e) => updateMetadata('engine', e.target.value)}
            className="mt-2 h-11"
          />
        </div>
      </div>
    )
  }
  if (slug === 'tours' || categoryName.includes('tour')) {
    return (
      <div>
        <UiLabel className="text-sm font-medium text-slate-700">{t('fieldDuration')}</UiLabel>
        <UiInput
          type="text"
          placeholder={t('fieldDurationPlaceholder')}
          value={formData.metadata.duration}
          onChange={(e) => updateMetadata('duration', e.target.value)}
          className="mt-2 h-11"
        />
      </div>
    )
  }
  if (isTransportListingCategory(slug)) {
    return null
  }
  if (
    slug === 'nanny' ||
    slug === 'babysitter' ||
    isPartnerListingHousingCategory(slug, formData.categoryName)
  ) {
    return (
      <PartnerListingSearchMetadataFields
        categorySlug={slug}
        categoryNameFallback={formData.categoryName}
        language={language}
        metadata={formData.metadata}
        updateMetadata={updateMetadata}
        variant="wizard"
      />
    )
  }
  return (
    <div className="py-8 text-center text-slate-500">
      <Building2 className="mx-auto mb-2 h-12 w-12 text-slate-300" />
      <p>{t('selectCategoryToSeeFields')}</p>
    </div>
  )
}

/** Specs + amenities (inline on step 1). */
function WizardSpecsSectionInner() {
  const w = useListingWizard()
  const {
    t,
    formData,
    getAmenityName,
    language,
    getCategoryName,
    listingCategorySlug,
    transportWizard,
    partnerAmenitySlugs,
    amenitiesHintKey,
    updateMetadata,
  } = w
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          {transportWizard ? t('listingSpecsTransport') : t('listingSpecs')}
        </h2>
        <p className="leading-relaxed text-slate-600">
          {transportWizard
            ? t('addDetailsForTransport')
            : `${t('addDetailsFor')} ${getCategoryName(listingCategorySlug, language) || formData.categoryName || ''}.`}
        </p>
        {transportWizard ? (
          <p className="text-sm leading-relaxed text-slate-500">{t('wizardVehicleSpecsOnStep1Reminder')}</p>
        ) : null}
      </div>
      <SpecsFields />
      {partnerAmenitySlugs.length > 0 && (
        <div className="space-y-3 pt-2">
          <UiLabel className="text-base font-medium text-slate-800">{t('amenities')}</UiLabel>
          <p className="text-xs leading-relaxed text-slate-500">{t(amenitiesHintKey)}</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {partnerAmenitySlugs.map((slug) => {
              const selected = formData.metadata.amenities?.includes(slug)
              return (
                <UiButton
                  key={slug}
                  variant={selected ? 'default' : 'outline'}
                  size="sm"
                  type="button"
                  onClick={() => {
                    const current = formData.metadata.amenities || []
                    const updated = selected ? current.filter((a) => a !== slug) : [...current, slug]
                    updateMetadata('amenities', updated)
                  }}
                  className={`h-auto min-h-10 whitespace-normal px-3 py-2 text-center text-sm leading-snug ${
                    selected ? 'bg-teal-600 hover:bg-teal-700' : ''
                  }`}
                >
                  {getAmenityName(slug, language, slug)}
                </UiButton>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export const WizardSpecsSection = memo(WizardSpecsSectionInner)
