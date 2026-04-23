'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { ImageIcon, Loader2 } from 'lucide-react'
import { ProxiedImage } from '@/components/proxied-image'
import { PartnerCalendarEducationCard } from '@/components/partner/PartnerCalendarEducationCard'
import { useListingWizard } from '../context/ListingWizardContext'

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
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-2xl font-semibold">{t('addPhotos')}</h2>
        <p className="text-slate-600">{t('showcasePhotos')}</p>
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
        className="cursor-pointer rounded-lg border-2 border-dashed border-slate-300 p-12 text-center transition-colors hover:border-teal-500"
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
        <div className="grid grid-cols-4 gap-4">
          {formData.images.map((img, idx) => (
            <div
              key={`${img}-${idx}`}
              className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200"
            >
              <ProxiedImage src={img} alt="" fill className="object-cover" sizes="25vw" />
              {idx === 0 && <Badge className="absolute left-2 top-2 bg-teal-600">{t('coverBadge')}</Badge>}
              <Button
                variant="destructive"
                size="icon"
                className="absolute right-2 top-2 h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
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
