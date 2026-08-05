'use client'

import { memo, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ImageIcon, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { ProxiedImage } from '@/components/proxied-image'
import { WizardSchemaFields } from '@/components/partner/WizardSchemaFields'
import { getWizardStep1TransportFields } from '@/lib/config/category-form-schema'
import { useListingWizard } from '../context/ListingWizardContext'
import { WizardSpecsSection } from './WizardSpecsSection'
import { PartnerCategoryPickerTwoStep } from '@/components/partner/PartnerCategoryPickerTwoStep'
import {
  WIZARD_STEP_ROOT_CLASS,
  WIZARD_STEP_SUBTITLE_CLASS,
  WIZARD_STEP_TITLE_CLASS,
} from './wizard-step-layout'
import { cn } from '@/lib/utils'
import {
  wizardFieldErrorClass,
  wizardFieldHasError,
  WIZARD_FIELD_ERROR_BOX,
} from '../lib/wizard-field-errors'

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
    listingCategorySlug,
    listingCategoryWizardProfile,
    resolveListingIdForUpload,
    getCategoryDisplayName,
    aiDescriptionLoading,
    aiDescQuota,
    handleAiImproveDescription,
    handleAiTranslateDescription,
    updateMetadata,
    isEditMode,
    editId,
    stepFieldErrors,
    tr,
  } = w

  const checkInPhotosRef = useRef(null)
  const [checkInPhotosUploading, setCheckInPhotosUploading] = useState(false)

  const hasCheckInContent =
    String(formData.metadata?.check_in_instructions ?? '').trim().length > 0 ||
    (Array.isArray(formData.metadata?.check_in_photos) && formData.metadata.check_in_photos.length > 0)

  const errService = wizardFieldHasError(stepFieldErrors, 'listingServiceType')
  const errCategory = wizardFieldHasError(stepFieldErrors, 'categoryId')
  const errTitle = wizardFieldHasError(stepFieldErrors, 'title')
  const errDesc = wizardFieldHasError(stepFieldErrors, 'description')

  return (
    <div className={WIZARD_STEP_ROOT_CLASS}>
      <div>
        <h2 className={`mb-2 ${WIZARD_STEP_TITLE_CLASS}`}>{t('tellUsAboutListing')}</h2>
        <p className={WIZARD_STEP_SUBTITLE_CLASS}>{t('startWithBasics')}</p>
      </div>

      {/* Section A — identity (Airbnb-like: decide what you're listing first) */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="text-sm font-semibold tracking-tight text-slate-900">{t('wizardSection_identity')}</h3>
        <div
          className={cn(
            'space-y-3 rounded-xl border bg-slate-50/60 p-4',
            errService ? WIZARD_FIELD_ERROR_BOX : 'border-slate-200',
          )}
          data-wizard-field="listingServiceType"
          data-wizard-field-error={errService ? 'true' : undefined}
        >
          <Label className={cn('text-base font-medium', errService && 'text-red-700')}>
            {t('wizardServiceTypeLabel')}
          </Label>
          <p className="text-xs text-slate-600">{t('wizardServiceTypeHint')}</p>
          {errService ? (
            <p className="text-xs font-medium text-red-600">{t('wizardBlocker_serviceType')}</p>
          ) : null}
          <RadioGroup
            value={formData.listingServiceType || ''}
            onValueChange={setListingServiceType}
            className="grid gap-2 sm:grid-cols-2"
          >
            {(['stay', 'transport', 'service', 'tour']).map((value) => (
              <label
                key={value}
                className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm hover:border-brand/40"
              >
                <RadioGroupItem value={value} id={`svc-${value}`} />
                <span className="font-medium text-slate-800">{t(`wizardServiceType_${value}`)}</span>
              </label>
            ))}
          </RadioGroup>
        </div>
        <div
          data-wizard-field="categoryId"
          data-wizard-field-error={errCategory ? 'true' : undefined}
          className={cn(errCategory && cn('rounded-xl p-2', WIZARD_FIELD_ERROR_BOX))}
        >
          <Label className={cn('text-base font-medium', errCategory && 'text-red-700')}>
            {t('selectCategory')}
          </Label>
          <p className="mt-1 text-xs text-slate-600">
            {formData.listingServiceType ? t('wizardCategoryTwoStepHint') : t('wizardSelectServiceTypeFirst')}
          </p>
          {errCategory ? (
            <p className="mt-1 text-xs font-medium text-red-600">{t('wizardBlocker_category')}</p>
          ) : null}
          <div className="mt-3">
            <PartnerCategoryPickerTwoStep
              categories={wizardCategoriesForSelect}
              listingServiceType={formData.listingServiceType}
              categoryId={formData.categoryId}
              language={language}
              t={t}
              getCategoryDisplayName={getCategoryDisplayName}
              onSelectCategoryId={setCategoryId}
              disabled={!formData.listingServiceType}
            />
          </div>
        </div>
        {transportWizard && formData.categoryId ? (
          (() => {
            const transportFields = getWizardStep1TransportFields(
              listingCategorySlug,
              listingCategoryWizardProfile,
            )
            if (!transportFields.length) return null
            return (
              <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 space-y-3">
                <p className="text-sm leading-relaxed text-slate-600">{t('wizardSpecsVehicleSearchHint')}</p>
                <WizardSchemaFields
                  fields={transportFields}
                  metadata={formData.metadata}
                  updateMetadata={updateMetadata}
                  t={t}
                  language={language}
                  fuelPolicyHint
                />
              </div>
            )
          })()
        ) : null}
      </section>

      {/* Section B — title / description / AI */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="text-sm font-semibold tracking-tight text-slate-900">{t('wizardSection_basics')}</h3>
        <div
          data-wizard-field="title"
          data-wizard-field-error={errTitle ? 'true' : undefined}
        >
          <Label className={cn('text-base font-medium text-slate-800', errTitle && 'text-red-700')}>
            {t('listingTitleLabel')}
          </Label>
          <Input
            type="text"
            placeholder={t('titlePlaceholder')}
            value={formData.title}
            onChange={(e) => updateField('title', e.target.value)}
            className={cn('mt-2 h-12', wizardFieldErrorClass(stepFieldErrors, 'title'))}
            maxLength={100}
            aria-invalid={errTitle || undefined}
          />
          {errTitle ? (
            <p className="mt-1 text-xs font-medium text-red-600">
              {tr('wizardBlocker_title', {
                min: 3,
                current: formData.title.length,
              })}
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              {formData.title.length}/100 {t('characters')}
            </p>
          )}
        </div>
        <div
          data-wizard-field="description"
          data-wizard-field-error={errDesc ? 'true' : undefined}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Label className={cn('text-base font-medium text-slate-800', errDesc && 'text-red-700')}>
              {t('listingDescriptionLabel')}
            </Label>
            <TooltipProvider delayDuration={200}>
              <div className="flex flex-wrap items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button
                        type="button"
                        variant="brand"
                        className="min-h-[44px] min-w-[44px] shrink-0 disabled:opacity-50"
                        disabled={aiDescriptionLoading || aiDescQuota.exhausted}
                        onClick={handleAiImproveDescription}
                        data-testid="wizard-ai-improve-btn"
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-[44px] min-w-[44px] shrink-0 disabled:opacity-50"
                        disabled={
                          aiDescriptionLoading ||
                          aiDescQuota.exhausted ||
                          String(formData.description || '').trim().length < 40
                        }
                        onClick={handleAiTranslateDescription}
                        data-testid="wizard-ai-translate-btn"
                      >
                        {t('translateDescriptionAI')}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p>
                      {aiDescQuota.exhausted
                        ? t('improveDescriptionAILimitExhausted')
                        : t('translateDescriptionAIHint')}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
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
            className={cn('mt-2 min-h-[140px]', wizardFieldErrorClass(stepFieldErrors, 'description'))}
            maxLength={2000}
            aria-invalid={errDesc || undefined}
          />
          {errDesc ? (
            <p className="mt-1 text-xs font-medium text-red-600">
              {tr('wizardBlocker_description', {
                min: 40,
                current: String(formData.description || '').trim().length,
              })}
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              {formData.description.length}/2000 {t('characters')}
            </p>
          )}
        </div>
      </section>

      {/* Section C — check-in / handoff (collapsed by default unless already filled) */}
      {formData.listingServiceType ? (
        <details
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm open:pb-5 sm:p-5"
          defaultOpen={hasCheckInContent}
        >
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center text-sm font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
            {t('wizardSection_checkInOptional')}
          </summary>
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            <Label className="text-base font-medium text-slate-800">{t('wizardCheckInInstructionsLabel')}</Label>
            <p className="text-xs text-slate-600 leading-relaxed">{t('wizardCheckInInstructionsHint')}</p>
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
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
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
                    const folderId = await resolveListingIdForUpload()
                    if (!folderId) return
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
                  className="min-h-[44px]"
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
                        className="absolute right-1 top-1 h-11 w-11 min-h-[44px] min-w-[44px] opacity-0 transition-opacity group-hover:opacity-100"
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
        </details>
      ) : null}

      {formData.categoryId ? (
        <Card className="rounded-2xl border-slate-200/80 p-4 sm:p-5">
          <WizardSpecsSection />
        </Card>
      ) : null}
    </div>
  )
}

export const StepGeneralInfo = memo(StepGeneralInfoInner)
