'use client'

/**
 * @file components/chat/composer/MediaUploader.jsx
 *
 * Скрытый file-input + кнопка 📎 для прикрепления медиафайлов.
 *
 * @param {Object}   props
 * @param {Function} props.onAttachFile — (file: File) => void|Promise
 * @param {boolean}  [props.disabled]
 * @param {string}   [props.accept]    — MIME-типы (по умолчанию изображения + PDF)
 */

import { useRef, useState } from 'react'
import { Loader2, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'

const DEFAULT_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,application/pdf'

export function MediaUploader({ onAttachFile, disabled, accept = DEFAULT_ACCEPT }) {
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)

  async function handleChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !onAttachFile) return
    setBusy(true)
    try {
      await onAttachFile(file)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept={accept}
        onChange={handleChange}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-10 w-10 flex-shrink-0 border-slate-200"
        disabled={disabled || busy}
        aria-label="Прикрепить файл"
        onClick={() => fileRef.current?.click()}
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
      </Button>
    </>
  )
}
