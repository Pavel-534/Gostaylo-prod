'use client'

/**
 * Non-critical root chrome — deferred client chunk (Stage 171.31).
 * SW registration, chunk reload guard, toast host.
 */

import { SwRegister } from '@/components/sw-register'
import { ChunkLoadResilience } from '@/components/pwa/ChunkLoadResilience'
import { Toaster } from 'sonner'

export function DeferredRootChrome() {
  return (
    <>
      <SwRegister />
      <ChunkLoadResilience />
      <Toaster
        position="top-center"
        richColors
        closeButton
        toastOptions={{
          classNames: {
            toast:
              'group rounded-2xl border border-slate-200/90 bg-white text-slate-900 shadow-lg shadow-slate-900/10',
            title: 'text-slate-900 font-semibold',
            description: 'text-slate-600 text-sm',
            success: 'border-emerald-200/80',
            error: 'border-rose-200/80',
            warning: 'border-amber-200/80',
            info: 'border-sky-200/80',
          },
        }}
      />
    </>
  )
}
