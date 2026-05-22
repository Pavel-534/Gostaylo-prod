'use client'

import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'

/**
 * Stage 115.1 — единые loading / sign-in для messages hall и thread.
 */
export function MessagesAuthGate({ authLoading, user, language, openLoginModal }) {
  if (authLoading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8" role="status" aria-live="polite">
        <Loader2 className="h-8 w-8 animate-spin text-brand" aria-hidden />
        <p className="text-sm text-slate-600">{getUIText('loading', language)}</p>
      </div>
    )
  }
  if (!user) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-slate-600 max-w-sm">{getUIText('messengerThread_signInRequired', language)}</p>
        <Button variant="brand" onClick={() => openLoginModal?.('login')}>
          {getUIText('messengerThread_signIn', language)}
        </Button>
      </div>
    )
  }
  return null
}
