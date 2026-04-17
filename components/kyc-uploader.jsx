'use client'

import { useState } from 'react'
import { Loader2, CheckCircle, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'

const DEFAULT_STRINGS = {
  label: 'Документ (паспорт/ID)',
  requiredBadge: '',
  uploading: 'Сжатие и загрузка…',
  uploaded: 'Документ загружен',
  remove: 'Удалить',
  tapToUpload: 'Нажмите для загрузки',
  fileTypesHint: 'JPG, PNG или PDF (до 4MB)',
  privacyHint: 'Ускоряет проверку заявки. Документ виден только администратору.',
  errorTooLarge: 'Файл слишком большой. Попробуйте файл меньшего размера.',
  errorUploadFailed: 'Не удалось загрузить файл',
}

const MAX_CLIENT_BYTES = 4 * 1024 * 1024

/**
 * KYC file upload for partner onboarding — uses POST /api/v2/upload, bucket verification_documents.
 *
 * @param {{ value: string | null, onChange: (url: string | null) => void, disabled?: boolean, strings?: Partial<typeof DEFAULT_STRINGS>, className?: string, onUploadError?: (message: string) => void, onUploadSuccess?: () => void }} props
 */
export function KycUploader({
  value,
  onChange,
  disabled = false,
  strings: stringsProp,
  className = '',
  onUploadError,
  onUploadSuccess,
}) {
  const strings = { ...DEFAULT_STRINGS, ...stringsProp }
  const [uploading, setUploading] = useState(false)

  return (
    <div className={`space-y-2 min-w-0 ${className}`}>
      <label className="block text-sm font-medium text-slate-700">
        {strings.label}
        {strings.requiredBadge ? (
          <span className="text-red-500 ml-0.5">{strings.requiredBadge}</span>
        ) : null}
      </label>
      <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center">
        {value ? (
          <div className="space-y-2">
            <CheckCircle className="h-8 w-8 text-green-500 mx-auto" aria-hidden />
            <p className="text-sm text-green-600 font-medium">{strings.uploaded}</p>
            <p className="text-xs text-slate-400 break-all px-2">
              {value.split('/').pop()?.slice(0, 36)}
              {value.length > 40 ? '…' : ''}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || uploading}
              onClick={() => onChange(null)}
            >
              {strings.remove}
            </Button>
          </div>
        ) : uploading ? (
          <div className="space-y-2">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600 mx-auto" aria-hidden />
            <p className="text-sm text-slate-500">{strings.uploading}</p>
          </div>
        ) : (
          <label className={`cursor-pointer block ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              disabled={disabled}
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setUploading(true)
                try {
                  let fileToUpload = file
                  if (file.type.startsWith('image/')) {
                    const imageCompression = (await import('browser-image-compression')).default
                    const options = {
                      maxSizeMB: 1,
                      maxWidthOrHeight: 1200,
                      useWebWorker: true,
                      initialQuality: 0.8,
                    }
                    try {
                      fileToUpload = await imageCompression(file, options)
                    } catch (compressErr) {
                      console.error('[KycUploader] Compression error:', compressErr)
                    }
                  }
                  if (fileToUpload.size > MAX_CLIENT_BYTES) {
                    throw new Error(strings.errorTooLarge)
                  }
                  const formData = new FormData()
                  formData.append('file', fileToUpload)
                  formData.append('bucket', 'verification_documents')
                  const res = await fetch('/api/v2/upload', {
                    method: 'POST',
                    credentials: 'include',
                    body: formData,
                  })
                  const result = await res.json().catch(() => ({}))
                  if (!res.ok || !result.success) {
                    throw new Error(result.error || strings.errorUploadFailed)
                  }
                  onChange(result.url)
                  onUploadSuccess?.()
                } catch (err) {
                  console.error('[KycUploader] Upload error:', err)
                  const msg = err?.message || strings.errorUploadFailed
                  onChange(null)
                  onUploadError?.(msg)
                } finally {
                  setUploading(false)
                  e.target.value = ''
                }
              }}
            />
            <Shield className="h-8 w-8 text-slate-400 mx-auto mb-2" aria-hidden />
            <p className="text-sm text-slate-600">{strings.tapToUpload}</p>
            <p className="text-xs text-slate-400 mt-1">{strings.fileTypesHint}</p>
          </label>
        )}
      </div>
      {strings.privacyHint ? (
        <p className="text-xs text-slate-500">{strings.privacyHint}</p>
      ) : null}
    </div>
  )
}
