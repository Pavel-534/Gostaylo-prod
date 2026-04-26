'use client'

import { memo } from 'react'
import { Building2 } from 'lucide-react'
import { Label as UiLabel } from '@/components/ui/label'
import { Button as UiButton } from '@/components/ui/button'
import { useListingWizard } from '../context/ListingWizardContext'
import { isTransportWizardCategory } from '@/lib/config/category-wizard-profile-db'
import { getWizardSpecsSectionFields } from '@/lib/config/category-form-schema'
import { WizardSchemaFields } from '@/components/partner/WizardSchemaFields'

function SpecsFields() {
  const w = useListingWizard()
  const { formData, updateMetadata, t, language, listingCategorySlug, listingCategoryWizardProfile } = w
  const slug = (listingCategorySlug || '').toLowerCase()

  if (isTransportWizardCategory(slug, listingCategoryWizardProfile)) {
    return null
  }

  const specsFields = getWizardSpecsSectionFields(slug, formData.categoryName, listingCategoryWizardProfile)
  if (specsFields.length > 0) {
    const showFeesDisclaimer = specsFields.some(
      (f) => f.key === 'cleaning_fee_thb' || f.key === 'security_deposit_thb',
    )
    return (
      <div className="space-y-4">
        <p className="rounded-r-md border-l-[3px] border-teal-500 bg-teal-50/50 py-2 pl-3 text-sm leading-relaxed text-slate-600">
          {t('wizardSpecsSearchHint')}
        </p>
        <WizardSchemaFields
          fields={specsFields}
          metadata={formData.metadata}
          updateMetadata={updateMetadata}
          t={t}
          language={language}
        />
        {showFeesDisclaimer ? (
          <p className="text-xs text-slate-500 leading-relaxed">{t('fieldFeesDisclaimer')}</p>
        ) : null}
      </div>
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
