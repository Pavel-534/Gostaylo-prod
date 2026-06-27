'use client'

import { useState, useCallback } from 'react'
import { X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { AirentoMark } from '@/components/brand/airento-mark'
import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'
import { SW_MESSAGE_SKIP_WAITING } from '@/lib/pwa/service-worker-messages.js'

/**
 * Branded PWA service-worker update prompt (Stage 171.22).
 */
export function PwaSwUpdateToast({
  toastId,
  language,
  waitingWorker,
  onDismiss,
  onUpdateStart,
}) {
  const [updating, setUpdating] = useState(false)

  const handleDismiss = useCallback(() => {
    if (updating) return
    onDismiss?.()
    toast.dismiss(toastId)
  }, [onDismiss, toastId, updating])

  const handleUpdate = useCallback(() => {
    if (updating || !waitingWorker) return
    setUpdating(true)
    onUpdateStart?.()

    waitingWorker.postMessage({ type: SW_MESSAGE_SKIP_WAITING })

    window.setTimeout(() => {
      window.location.reload()
    }, 2500)
  }, [onUpdateStart, updating, waitingWorker])

  return (
    <div
      role="status"
      aria-live="polite"
      className="relative flex w-[min(calc(100vw-2rem),22rem)] items-center gap-3 rounded-2xl border border-slate-700/80 bg-slate-900 px-3.5 py-3.5 pr-3 shadow-xl shadow-black/30"
    >
      <button
        type="button"
        onClick={handleDismiss}
        disabled={updating}
        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-40"
        aria-label={getUIText('pwaSwUpdate_dismiss', language)}
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/95 ring-1 ring-white/10">
        <AirentoMark size={26} />
      </div>

      <div className="min-w-0 flex-1 px-0.5 text-center">
        <p className="text-sm font-semibold leading-snug text-white">
          {getUIText('pwaSwUpdate_message', language)}
        </p>
        <p className="mt-0.5 text-xs leading-snug text-slate-400">
          {getUIText('pwaSwUpdate_subtitle', language)}
        </p>
      </div>

      <Button
        type="button"
        variant="brand"
        size="sm"
        disabled={updating}
        onClick={handleUpdate}
        className="shrink-0 px-3.5"
      >
        {updating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {getUIText('pwaSwUpdate_loading', language)}
          </>
        ) : (
          getUIText('pwaSwUpdate_action', language)
        )}
      </Button>
    </div>
  )
}
