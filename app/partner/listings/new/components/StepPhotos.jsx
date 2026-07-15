'use client'

import { memo, useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ImageIcon, Loader2 } from 'lucide-react'
import { PartnerCalendarEducationCard } from '@/components/partner/PartnerCalendarEducationCard'
import { ListingPhotoSortGrid } from '@/components/partner/listings/ListingPhotoSortGrid'
import { useListingWizard } from '../context/ListingWizardContext'
import {
  WIZARD_STEP_ROOT_CLASS,
  WIZARD_STEP_SUBTITLE_CLASS,
  WIZARD_STEP_TITLE_CLASS,
} from './wizard-step-layout'
import { cn } from '@/lib/utils'

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
  } = w

  const [fileDragOver, setFileDragOver] = useState(false)

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
        <h2 className={`mb-2 ${WIZARD_STEP_TITLE_CLASS}`}>{t('addPhotos')}</h2>
        <p className={WIZARD_STEP_SUBTITLE_CLASS}>{t('showcasePhotos')}</p>
      </div>
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
          'cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors sm:p-12',
          fileDragOver
            ? 'border-brand bg-brand/5'
            : 'border-slate-300 hover:border-brand',
        )}
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
            'mx-auto mb-4 h-16 w-16',
            fileDragOver ? 'text-brand' : 'text-slate-400',
          )}
        />
        <h3 className="mb-2 text-lg font-medium">
          {fileDragOver ? t('photosDropActive') : t('dragDropImages')}
        </h3>
        <p className="mb-4 text-slate-500">{t('orClickToBrowse')}</p>
        <Button variant="outline" disabled={uploading} type="button">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('selectFiles')}
        </Button>
      </div>
      {uploading && uploadProgress > 0 && (
        <div className="space-y-1">
          <Progress value={uploadProgress} className="h-2" />
          <p className="text-center text-xs text-slate-500">{uploadProgress}%</p>
        </div>
      )}
      {formData.images.length > 0 && (
        <ListingPhotoSortGrid
          images={formData.images}
          onReorder={reorderImages}
          onRemove={removeImage}
          coverLabel={t('coverBadge')}
          reorderHint={t('photosDragToReorder')}
        />
      )}
      <PartnerCalendarEducationCard variant="wizard" className="mt-8" manualCalendarOnly={transportWizard} />
    </div>
  )
}

export const StepPhotos = memo(StepPhotosInner)
