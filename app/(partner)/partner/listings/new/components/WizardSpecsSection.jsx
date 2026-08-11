'use client'

import { memo } from 'react'
import { Building2 } from 'lucide-react'
import { Label as UiLabel } from '@/components/ui/label'
import { Button as UiButton } from '@/components/ui/button'
import { useListingWizard } from '../context/ListingWizardContext'
import { isTransportWizardCategory } from '@/lib/config/category-wizard-profile-db'
import { getWizardSpecsSectionFields } from '@/lib/config/category-form-schema'
import { WizardSchemaFields } from '@/components/partner/WizardSchemaFields'
import { PartnerSectionDivider } from '@/components/partner/PartnerSectionDivider'
import {
  PARTNER_FIELD_LABEL_CLASS,
  PARTNER_SECTION_TITLE_CLASS,
} from '@/lib/ui/partner-section-rhythm'
import { formatWizardAddDetailsLine } from '@/lib/i18n/wizard-add-details-line'

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
        <p className="rounded-r-md border-l-[3px] border-brand bg-brand/5 py-2 pl-3 text-sm leading-relaxed text-slate-600">
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
  const categoryLabel = getCategoryName(listingCategorySlug, language) || formData.categoryName || ''
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className={PARTNER_SECTION_TITLE_CLASS}>
          {transportWizard ? t('listingSpecsTransport') : t('listingSpecs')}
        </h3>
        <p className="text-sm leading-relaxed text-slate-600">
          {transportWizard
            ? t('addDetailsForTransport')
            : formatWizardAddDetailsLine(t, language, categoryLabel)}
        </p>
        {transportWizard ? (
          <p className="text-sm leading-relaxed text-slate-500">{t('wizardVehicleSpecsOnStep1Reminder')}</p>
        ) : null}
      </div>
      <SpecsFields />
      {partnerAmenitySlugs.length > 0 && (
        <>
          <PartnerSectionDivider wrapClassName="py-2 sm:py-3" />
          <div className="space-y-3">
            <UiLabel className={PARTNER_FIELD_LABEL_CLASS}>{t('amenities')}</UiLabel>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {partnerAmenitySlugs.map((slug) => {
                const selected = formData.metadata.amenities?.includes(slug)
                return (
                  <UiButton
                    key={slug}
                    variant={selected ? 'brand' : 'outline'}
                    size="sm"
                    type="button"
                    onClick={() => {
                      const current = formData.metadata.amenities || []
                      const updated = selected ? current.filter((a) => a !== slug) : [...current, slug]
                      updateMetadata('amenities', updated)
                    }}
                    className="h-auto min-h-10 whitespace-normal px-3 py-2 text-center text-sm leading-snug"
                  >
                    {getAmenityName(slug, language, slug)}
                  </UiButton>
                )
              })}
            </div>
            <p className="text-xs leading-relaxed text-slate-500">{t(amenitiesHintKey)}</p>
          </div>
        </>
      )}
    </div>
  )
}

export const WizardSpecsSection = memo(WizardSpecsSectionInner)
