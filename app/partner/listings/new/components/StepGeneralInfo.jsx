'use client'

import { memo, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ImageIcon, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { ProxiedImage } from '@/components/proxied-image'
import { PartnerListingImportBlock } from '@/components/partner/PartnerListingImportBlock'
import { PartnerListingSearchMetadataFields } from '@/components/partner/PartnerListingSearchMetadataFields'
import { useListingWizard } from '../context/ListingWizardContext'
import { WizardSpecsSection } from './WizardSpecsSection'

function pickupInstructionsPlaceholder(listingServiceType, t) {
  switch (listingServiceType) {
    case 'transport':
      return t('wizardCheckInInstructionsPlaceholder_transport')
    case 'tour':
      return t('wizardCheckInInstructionsPlaceholder_tour')
    case 'service':
      return t('wizardCheckInInstructionsPlaceholder_service')
    case 'stay':
      return t('wizardCheckInInstructionsPlaceholder_stay')
    default:
      return t('wizardCheckInInstructionsPlaceholder_default')
  }
}

function StepGeneralInfoInner() {
  const w = useListingWizard()
  const {
    t,
    language,
    formData,
    updateField,
    updateDescription,
    setCategoryId,
    setListingServiceType,
    wizardCategoriesForSelect,
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

  const checkInPhotosRef = useRef(null)
  const [checkInPhotosUploading, setCheckInPhotosUploading] = useState(false)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-2xl font-semibold">{t('tellUsAboutListing')}</h2>
        <p className="text-slate-600">{t('startWithBasics')}</p>
      </div>
      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <Label className="text-base font-medium">{t('wizardServiceTypeLabel')}</Label>
        <p className="text-xs text-slate-600">{t('wizardServiceTypeHint')}</p>
        <RadioGroup
          value={formData.listingServiceType || ''}
          onValueChange={setListingServiceType}
          className="grid gap-2 sm:grid-cols-2"
        >
          {(['stay', 'transport', 'service', 'tour']).map((value) => (
            <label
              key={value}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm hover:border-teal-300"
            >
              <RadioGroupItem value={value} id={`svc-${value}`} />
              <span className="font-medium text-slate-800">{t(`wizardServiceType_${value}`)}</span>
            </label>
          ))}
        </RadioGroup>
      </div>
      <div>
        <Label className="text-base font-medium">{t('selectCategory')}</Label>
        <Select
          value={formData.categoryId}
          onValueChange={setCategoryId}
          disabled={!formData.listingServiceType}
        >
          <SelectTrigger className="mt-2 h-12">
            <SelectValue
              placeholder={
                formData.listingServiceType ? t('selectCategoryPlaceholder') : t('wizardSelectServiceTypeFirst')
              }
            />
          </SelectTrigger>
          <SelectContent>
            {wizardCategoriesForSelect.map((cat) => (
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
      {formData.listingServiceType ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <Label className="text-base font-medium text-slate-800">{t('wizardCheckInInstructionsLabel')}</Label>
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">{t('wizardCheckInInstructionsHint')}</p>
          <Textarea
            value={String(formData.metadata?.check_in_instructions ?? '')}
            onChange={(e) => updateMetadata('check_in_instructions', e.target.value)}
            placeholder={pickupInstructionsPlaceholder(formData.listingServiceType, t)}
            className="mt-2 min-h-[96px]"
            maxLength={2000}
          />
          <p className="mt-1 text-xs text-slate-500">
            {String(formData.metadata?.check_in_instructions ?? '').length}/2000 {t('characters')}
          </p>
          <div className="mt-4 border-t border-slate-100 pt-4 space-y-2">
            <Label className="text-sm font-medium text-slate-800">{t('wizardCheckInPhotosLabel')}</Label>
            <p className="text-xs text-slate-600 leading-relaxed">{t('wizardCheckInPhotosHint')}</p>
            <input
              ref={checkInPhotosRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={async (e) => {
                const picked = Array.from(e.target.files || []).filter((f) => f.type?.startsWith('image/'))
                if (checkInPhotosRef.current) checkInPhotosRef.current.value = ''
                if (picked.length === 0) return
                const existing = Array.isArray(formData.metadata?.check_in_photos)
                  ? formData.metadata.check_in_photos.filter((u) => typeof u === 'string' && u.trim())
                  : []
                const room = 3 - existing.length
                if (room <= 0) {
                  toast.error(t('wizardCheckInPhotosMax'))
                  return
                }
                const slice = picked.slice(0, room)
                setCheckInPhotosUploading(true)
                try {
                  const folderId =
                    isEditMode && editId ? `${editId}-checkin` : `wizard-checkin-${Date.now()}`
                  const { processAndUploadImages } = await import('@/lib/services/image-upload.service')
                  const uploaded = await processAndUploadImages(slice, folderId, () => {})
                  if (uploaded.length > 0) {
                    updateMetadata('check_in_photos', [...existing, ...uploaded].slice(0, 3))
                    toast.success(t('wizardCheckInPhotosUploaded').replace('{{n}}', String(uploaded.length)))
                  }
                } catch (err) {
                  console.error(err)
                  toast.error(t('uploadFailedToast'))
                } finally {
                  setCheckInPhotosUploading(false)
                }
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={checkInPhotosUploading || (formData.metadata?.check_in_photos?.length || 0) >= 3}
                onClick={() => checkInPhotosRef.current?.click()}
              >
                {checkInPhotosUploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ImageIcon className="mr-2 h-4 w-4" />
                )}
                {t('wizardCheckInPhotosUpload')}
              </Button>
              <span className="text-xs text-slate-500">{t('wizardCheckInPhotosMax')}</span>
            </div>
            {Array.isArray(formData.metadata?.check_in_photos) && formData.metadata.check_in_photos.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 pt-1">
                {formData.metadata.check_in_photos.map((url, idx) => (
                  <div
                    key={`${url}-${idx}`}
                    className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                  >
                    <ProxiedImage src={url} alt="" fill className="object-cover" sizes="120px" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute right-1 top-1 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => {
                        const next = formData.metadata.check_in_photos.filter((_, i) => i !== idx)
                        updateMetadata('check_in_photos', next)
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {formData.categoryId ? (
        <Card className="border-slate-200/80 p-4 sm:p-5">
          <WizardSpecsSection />
        </Card>
      ) : null}
    </div>
  )
}

export const StepGeneralInfo = memo(StepGeneralInfoInner)
