'use client'

import { memo, useRef, useState } from 'react'
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
import { WizardStayArrivalHours } from './WizardStayArrivalHours'
import { PartnerCategoryPickerTwoStep } from '@/components/partner/PartnerCategoryPickerTwoStep'
import {
  WIZARD_STEP_ROOT_CLASS,
  WIZARD_STEP_SUBTITLE_CLASS,
  WIZARD_STEP_TITLE_CLASS,
  WIZARD_MOBILE_FLAT_SECTION_CLASS,
  WIZARD_MOBILE_FLAT_INSET_CLASS,
  WIZARD_MOBILE_FLAT_CARD_CLASS,
} from './wizard-step-layout'
import { cn } from '@/lib/utils'
import {
  wizardFieldErrorClass,
  wizardFieldHasError,
  WIZARD_FIELD_ERROR_BOX,
} from '../lib/wizard-field-errors'
import { PartnerSectionDivider } from '@/components/partner/PartnerSectionDivider'
import {
  PARTNER_FIELD_LABEL_CLASS,
  PARTNER_SECTION_TITLE_CLASS,
} from '@/lib/ui/partner-section-rhythm'
import { readStayArrivalFromMetadata } from '@/lib/listing/stay-arrival-hours'

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

  const arrival = readStayArrivalFromMetadata(formData.metadata)
  const isStayService = formData.listingServiceType === 'stay'

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
      <section className={WIZARD_MOBILE_FLAT_SECTION_CLASS} data-partner-section="basics-identity">
        <h3 className={PARTNER_SECTION_TITLE_CLASS}>{t('wizardSection_identity')}</h3>
        <div
          className={cn(
            WIZARD_MOBILE_FLAT_INSET_CLASS,
            errService && WIZARD_FIELD_ERROR_BOX,
            errService && 'max-sm:rounded-xl max-sm:border max-sm:p-3',
          )}
          data-wizard-field="listingServiceType"
          data-wizard-field-error={errService ? 'true' : undefined}
        >
          <Label className={cn(PARTNER_FIELD_LABEL_CLASS, errService && 'text-red-700')}>
            {t('wizardServiceTypeLabel')}
          </Label>
          {errService ? (
            <p className="text-xs font-medium text-red-600">{t('wizardBlocker_serviceType')}</p>
          ) : null}
          <RadioGroup
            value={formData.listingServiceType || ''}
            onValueChange={setListingServiceType}
            className="mt-2 grid w-full gap-2 sm:grid-cols-2"
          >
            {(['stay', 'transport', 'service', 'tour']).map((value) => (
              <label
                key={value}
                className="flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm hover:border-brand/40"
              >
                <RadioGroupItem value={value} id={`svc-${value}`} />
                <span className="min-w-0 flex-1 font-medium text-slate-800">
                  {t(`wizardServiceType_${value}`)}
                </span>
              </label>
            ))}
          </RadioGroup>
          <p className="mt-2 text-xs text-slate-600">{t('wizardServiceTypeHint')}</p>
        </div>
        <div
          data-wizard-field="categoryId"
          data-wizard-field-error={errCategory ? 'true' : undefined}
          className={cn(errCategory && cn('rounded-xl p-2', WIZARD_FIELD_ERROR_BOX))}
        >
          <Label className={cn(PARTNER_FIELD_LABEL_CLASS, errCategory && 'text-red-700')}>
            {t('selectCategory')}
          </Label>
          {errCategory ? (
            <p className="mt-1 text-xs font-medium text-red-600">{t('wizardBlocker_category')}</p>
          ) : null}
          <div className="mt-3 w-full min-w-0">
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
          <p className="mt-2 text-xs text-slate-600">
            {formData.listingServiceType ? t('wizardCategoryTwoStepHint') : t('wizardSelectServiceTypeFirst')}
          </p>
        </div>
        {transportWizard && formData.categoryId ? (
          (() => {
            const transportFields = getWizardStep1TransportFields(
              listingCategorySlug,
              listingCategoryWizardProfile,
            )
            if (!transportFields.length) return null
            return (
              <div className={cn(WIZARD_MOBILE_FLAT_INSET_CLASS, 'sm:bg-slate-50/40')}>
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

      <PartnerSectionDivider />

      {/* Section B — title / description / AI */}
      <section className={WIZARD_MOBILE_FLAT_SECTION_CLASS} data-partner-section="basics-copy">
        <h3 className={PARTNER_SECTION_TITLE_CLASS}>{t('wizardSection_basics')}</h3>
        <div
          data-wizard-field="title"
          data-wizard-field-error={errTitle ? 'true' : undefined}
        >
          <Label className={cn(PARTNER_FIELD_LABEL_CLASS, errTitle && 'text-red-700')}>
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
          data-listing-health-anchor="description"
          data-wizard-field-error={errDesc ? 'true' : undefined}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Label className={cn(PARTNER_FIELD_LABEL_CLASS, errDesc && 'text-red-700')}>
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

      {isStayService ? (
        <>
          <PartnerSectionDivider />
          <WizardStayArrivalHours
            t={t}
            checkInTime={arrival.checkInTime}
            checkOutTime={arrival.checkOutTime}
            earlyCheckInOnRequest={arrival.earlyCheckInOnRequest}
            lateCheckOutOnRequest={arrival.lateCheckOutOnRequest}
            onCheckInTime={(v) => updateMetadata('check_in_time', v || null)}
            onCheckOutTime={(v) => updateMetadata('check_out_time', v || null)}
            onEarlyCheckIn={(v) => updateMetadata('early_check_in_on_request', v)}
            onLateCheckOut={(v) => updateMetadata('late_check_out_on_request', v)}
          />
          <div
            className={cn(WIZARD_MOBILE_FLAT_SECTION_CLASS, 'mt-4 space-y-2')}
            data-listing-health-anchor="house-rules"
          >
            <Label className={PARTNER_FIELD_LABEL_CLASS}>{t('wizardHouseRulesLabel')}</Label>
            <Textarea
              value={String(formData.metadata?.house_rules ?? '')}
              onChange={(e) => updateMetadata('house_rules', e.target.value)}
              placeholder={t('wizardHouseRulesPlaceholder')}
              className="min-h-[96px]"
              maxLength={2000}
              data-testid="wizard-house-rules"
            />
            <p className="text-xs text-slate-600 leading-relaxed">{t('wizardHouseRulesHint')}</p>
            <p className="text-xs text-slate-500">
              {String(formData.metadata?.house_rules ?? '').length}/2000 {t('characters')}
            </p>
          </div>
        </>
      ) : null}

      {/* Section C — check-in / handoff (collapsed by default unless already filled) */}
      {formData.listingServiceType ? (
        <>
          <PartnerSectionDivider />
        <details
          className={cn(WIZARD_MOBILE_FLAT_SECTION_CLASS, 'open:max-sm:pb-0 open:sm:pb-5')}
          data-listing-health-anchor="pickup"
          defaultOpen={
            String(formData.metadata?.check_in_instructions ?? '').trim().length > 0 ||
            (Array.isArray(formData.metadata?.check_in_photos) &&
              formData.metadata.check_in_photos.length > 0)
          }
        >
          <summary
            className={cn(
              PARTNER_SECTION_TITLE_CLASS,
              'flex min-h-[44px] cursor-pointer list-none items-center [&::-webkit-details-marker]:hidden',
            )}
          >
            {t('wizardSection_checkInOptional')}
          </summary>
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            <Label className={PARTNER_FIELD_LABEL_CLASS}>{t('wizardCheckInInstructionsLabel')}</Label>
            <Textarea
              value={String(formData.metadata?.check_in_instructions ?? '')}
              onChange={(e) => updateMetadata('check_in_instructions', e.target.value)}
              placeholder={pickupInstructionsPlaceholder(formData.listingServiceType, t)}
              className="mt-2 min-h-[96px]"
              maxLength={2000}
            />
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">{t('wizardCheckInInstructionsHint')}</p>
            <p className="mt-1 text-xs text-slate-500">
              {String(formData.metadata?.check_in_instructions ?? '').length}/2000 {t('characters')}
            </p>
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
              <Label className={PARTNER_FIELD_LABEL_CLASS}>{t('wizardCheckInPhotosLabel')}</Label>
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
              <p className="text-xs text-slate-600 leading-relaxed">{t('wizardCheckInPhotosHint')}</p>
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
        </>
      ) : null}

      {formData.categoryId ? (
        <>
          <PartnerSectionDivider />
          <div className={WIZARD_MOBILE_FLAT_CARD_CLASS} data-partner-section="basics-specs">
            <WizardSpecsSection />
          </div>
        </>
      ) : null}
    </div>
  )
}

export const StepGeneralInfo = memo(StepGeneralInfoInner)
