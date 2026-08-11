'use client'

import { memo, useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ImageIcon, Loader2 } from 'lucide-react'
import { PartnerCalendarEducationCard } from '@/components/partner/PartnerCalendarEducationCard'
import { ListingPhotoSortGrid } from '@/components/partner/listings/ListingPhotoSortGrid'
import { PartnerSectionDivider } from '@/components/partner/PartnerSectionDivider'
import {
  PARTNER_FIELD_LABEL_CLASS,
  PARTNER_SECTION_TITLE_CLASS,
} from '@/lib/ui/partner-section-rhythm'
import { useListingWizard } from '../context/ListingWizardContext'
import {
  WIZARD_STEP_ROOT_CLASS,
  WIZARD_STEP_TITLE_CLASS,
} from './wizard-step-layout'
import { cn } from '@/lib/utils'
import { WIZARD_FIELD_ERROR_BOX, wizardFieldHasError } from '../lib/wizard-field-errors'

function StepPhotosInner() {
  const w = useListingWizard()
  const {
    t,
    formData,
    fileInputRef,
    uploading,
    uploadProgress,
    handleImageUpload,
    removeImage,
    reorderImages,
    transportWizard,
    stepFieldErrors,
    tr,
  } = w

  const [fileDragOver, setFileDragOver] = useState(false)
  const errPhotos = wizardFieldHasError(stepFieldErrors, 'images')
  const hasGallery = formData.images.length > 0

  const onFilesDrop = useCallback(
    (fileList) => {
      if (!fileList?.length) return
      handleImageUpload(fileList)
    },
    [handleImageUpload],
  )

  const handleZoneDragOver = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    if (Array.from(e.dataTransfer?.types || []).includes('Files')) {
      setFileDragOver(true)
    }
  }, [])

  const handleZoneDragLeave = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setFileDragOver(false)
  }, [])

  const handleZoneDrop = useCallback(
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      setFileDragOver(false)
      onFilesDrop(e.dataTransfer?.files)
    },
    [onFilesDrop],
  )

  return (
    <div className={WIZARD_STEP_ROOT_CLASS}>
      <div>
        <h2 className={`mb-1 ${WIZARD_STEP_TITLE_CLASS}`}>{t('addPhotos')}</h2>
        <p className="text-xs leading-relaxed text-slate-500">{t('showcasePhotos')}</p>
      </div>

      <section data-partner-section="photos-upload" className="space-y-3">
        <h3 className={PARTNER_SECTION_TITLE_CLASS}>{t('wizardSection_photosUpload')}</h3>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => onFilesDrop(e.target.files)}
        />
        <div
          className={cn(
            'cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-colors sm:rounded-lg sm:p-12',
            'max-sm:shadow-none max-sm:bg-transparent',
            errPhotos
              ? WIZARD_FIELD_ERROR_BOX
              : fileDragOver
                ? 'border-brand bg-brand/5'
                : 'border-slate-300 hover:border-brand',
          )}
          data-wizard-field="images"
          data-wizard-field-error={errPhotos ? 'true' : undefined}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          onDragOver={handleZoneDragOver}
          onDragEnter={handleZoneDragOver}
          onDragLeave={handleZoneDragLeave}
          onDrop={handleZoneDrop}
          role="button"
          tabIndex={0}
        >
          <ImageIcon
            className={cn(
              'mx-auto mb-3 h-12 w-12 sm:mb-4 sm:h-16 sm:w-16',
              errPhotos ? 'text-red-500' : fileDragOver ? 'text-brand' : 'text-slate-400',
            )}
          />
          <p className={cn(PARTNER_FIELD_LABEL_CLASS, 'mb-1')}>
            {fileDragOver ? t('photosDropActive') : t('dragDropImages')}
          </p>
          <p className="mb-4 text-xs text-slate-500">{t('orClickToBrowse')}</p>
          {errPhotos ? (
            <p className="mb-3 text-sm font-medium text-red-600">
              {tr
                ? tr('wizardBlocker_photos', { min: 1, current: formData.images?.length || 0 })
                : t('wizardBlocker_photos')}
            </p>
          ) : null}
          <Button
            variant="outline"
            disabled={uploading}
            type="button"
            className="min-h-[44px] w-full sm:w-auto"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('selectFiles')}
          </Button>
        </div>
        {uploading && uploadProgress > 0 ? (
          <div className="space-y-1">
            <Progress value={uploadProgress} className="h-2" />
            <p className="text-center text-xs text-slate-500">{uploadProgress}%</p>
          </div>
        ) : null}
      </section>

      {hasGallery ? (
        <>
          <PartnerSectionDivider />
          <section data-partner-section="photos-gallery" className="space-y-3">
            <div>
              <h3 className={PARTNER_SECTION_TITLE_CLASS}>{t('wizardSection_photosGallery')}</h3>
              <p className={cn(PARTNER_FIELD_LABEL_CLASS, 'mt-1 font-normal text-slate-500')}>
                {t('photosDragToReorder')}
              </p>
            </div>
            <ListingPhotoSortGrid
              images={formData.images}
              onReorder={reorderImages}
              onRemove={removeImage}
              coverLabel={t('coverBadge')}
              reorderHint=""
            />
          </section>
        </>
      ) : null}

      <PartnerSectionDivider />

      <section data-partner-section="photos-tips" className="space-y-3">
        <h3 className={PARTNER_SECTION_TITLE_CLASS}>{t('wizardSection_photosTips')}</h3>
        <PartnerCalendarEducationCard
          variant="wizard"
          className="max-sm:shadow-none"
          manualCalendarOnly={transportWizard}
        />
      </section>
    </div>
  )
}

export const StepPhotos = memo(StepPhotosInner)
