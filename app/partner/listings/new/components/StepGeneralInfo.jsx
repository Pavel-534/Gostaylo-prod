'use client'

import { memo } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Loader2 } from 'lucide-react'
import { PartnerListingImportBlock } from '@/components/partner/PartnerListingImportBlock'
import { PartnerListingSearchMetadataFields } from '@/components/partner/PartnerListingSearchMetadataFields'
import { useListingWizard } from '../context/ListingWizardContext'
import { WizardSpecsSection } from './WizardSpecsSection'

function StepGeneralInfoInner() {
  const w = useListingWizard()
  const {
    t,
    language,
    formData,
    updateField,
    updateDescription,
    setCategoryId,
    categories,
    transportWizard,
    hideAirbnbImportBlock,
    listingCategorySlug,
    isEditMode,
    editId,
    getCategoryName,
    aiDescriptionLoading,
    aiDescQuota,
    handleAiImproveDescription,
    updateMetadata,
  } = w

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-2xl font-semibold">{t('tellUsAboutListing')}</h2>
        <p className="text-slate-600">{t('startWithBasics')}</p>
      </div>
      <div>
        <Label className="text-base font-medium">{t('selectCategory')}</Label>
        <Select value={formData.categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="mt-2 h-12">
            <SelectValue placeholder={t('selectCategoryPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {getCategoryName(cat.slug, language) || cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {transportWizard && formData.categoryId ? (
        <PartnerListingSearchMetadataFields
          categorySlug={listingCategorySlug}
          categoryNameFallback={formData.categoryName}
          language={language}
          metadata={formData.metadata}
          updateMetadata={updateMetadata}
          variant="wizard"
        />
      ) : null}
      {formData.categoryId && !hideAirbnbImportBlock ? (
        <PartnerListingImportBlock
          categoryId={formData.categoryId}
          variant="wizard"
          listingId={isEditMode && editId ? editId : undefined}
          migrateImportedImagesToStorage={!!(isEditMode && editId)}
          onApplyPreview={w.applyAirbnbPreview}
        />
      ) : null}
      <div>
        <Label className="text-base font-medium text-slate-800">{t('listingTitleLabel')}</Label>
        <Input
          type="text"
          placeholder={t('titlePlaceholder')}
          value={formData.title}
          onChange={(e) => updateField('title', e.target.value)}
          className="mt-2 h-12"
          maxLength={100}
        />
        <p className="mt-1 text-xs text-slate-500">
          {formData.title.length}/100 {t('characters')}
        </p>
      </div>
      <div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Label className="text-base font-medium text-slate-800">{t('listingDescriptionLabel')}</Label>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 border-violet-200 bg-violet-50/80 text-violet-900 hover:bg-violet-100 disabled:opacity-50"
                    disabled={aiDescriptionLoading || aiDescQuota.exhausted}
                    onClick={handleAiImproveDescription}
                  >
                    {aiDescriptionLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('improveDescriptionAILoading')}
                      </>
                    ) : (
                      t('improveDescriptionAI')
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              {aiDescQuota.exhausted ? (
                <TooltipContent side="bottom" className="max-w-xs">
                  <p>{t('improveDescriptionAILimitExhausted')}</p>
                </TooltipContent>
              ) : null}
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="mt-1 text-xs text-slate-500">{t('improveDescriptionAIHint')}</p>
        <p className="mt-1 text-xs text-slate-600">
          {t('improveDescriptionAIQuotaUsed')
            .replace('{{used}}', String(aiDescQuota.used))
            .replace('{{limit}}', String(aiDescQuota.limit))}
        </p>
        <Textarea
          placeholder={t('descriptionPlaceholder')}
          value={formData.description}
          onChange={(e) => updateDescription(e.target.value)}
          className="mt-2 min-h-[120px]"
          maxLength={2000}
        />
        <p className="mt-1 text-xs text-slate-500">
          {formData.description.length}/2000 {t('characters')}
        </p>
      </div>
      {formData.categoryId ? (
        <Card className="border-slate-200/80 p-4 sm:p-5">
          <WizardSpecsSection />
        </Card>
      ) : null}
    </div>
  )
}

export const StepGeneralInfo = memo(StepGeneralInfoInner)
