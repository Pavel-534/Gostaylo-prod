'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { ImageIcon, Loader2 } from 'lucide-react'
import { ProxiedImage } from '@/components/proxied-image'
import { PartnerCalendarEducationCard } from '@/components/partner/PartnerCalendarEducationCard'
import { useListingWizard } from '../context/ListingWizardContext'
import {
  WIZARD_STEP_ROOT_CLASS,
  WIZARD_STEP_SUBTITLE_CLASS,
  WIZARD_STEP_TITLE_CLASS,
} from './wizard-step-layout'

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
    transportWizard,
  } = w
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
        onChange={(e) => handleImageUpload(e.target.files)}
      />
      <div
        className="cursor-pointer rounded-lg border-2 border-dashed border-slate-300 p-8 text-center transition-colors hover:border-brand sm:p-12"
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <ImageIcon className="mx-auto mb-4 h-16 w-16 text-slate-400" />
        <h3 className="mb-2 text-lg font-medium">{t('dragDropImages')}</h3>
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
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-4">
          {formData.images.map((img, idx) => (
            <div
              key={`${img}-${idx}`}
              className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200"
            >
              <ProxiedImage src={img} alt="" fill className="object-cover" sizes="25vw" />
              {idx === 0 && <Badge className="absolute left-2 top-2 bg-brand">{t('coverBadge')}</Badge>}
              <Button
                variant="destructive"
                size="icon"
                className="absolute right-2 top-2 min-h-[44px] min-w-[44px] opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeImage(idx)
                }}
              >
                ×
              </Button>
            </div>
          ))}
        </div>
      )}
      <PartnerCalendarEducationCard variant="wizard" className="mt-8" manualCalendarOnly={transportWizard} />
    </div>
  )
}

export const StepPhotos = memo(StepPhotosInner)
