'use client'

/**
 * Stage 189.38 — One-tap push permission banner (default permission, eligible device).
 * iOS: only in standalone PWA. Android/desktop: any supported browser.
 */

import { useCallback, useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useI18n } from '@/contexts/i18n-context'
import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'
import { canRegisterWebPushOnThisDevice } from '@/lib/push/web-push-platform.js'
import { PUSH_ENABLE_EVENT } from '@/lib/push/web-push-client-state.js'
import {
  isPushSoftPromptSnoozed,
  snoozePushSoftPrompt,
} from '@/lib/push/push-soft-prompt-storage.js'

function readPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export function PushSoftPromptBanner({ className }) {
  const { user } = useAuth()
  const { language } = useI18n()
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user?.id) {
      setVisible(false)
      return
    }
    const permission = readPermission()
    if (permission !== 'default') {
      setVisible(false)
      return
    }
    if (!canRegisterWebPushOnThisDevice()) {
      setVisible(false)
      return
    }
    if (isPushSoftPromptSnoozed()) {
      setVisible(false)
      return
    }
    setVisible(true)
  }, [user?.id])

  const dismiss = useCallback(() => {
    snoozePushSoftPrompt()
    setVisible(false)
  }, [])

  const enable = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    setBusy(true)
    try {
      const next = await Notification.requestPermission()
      if (next === 'granted') {
        setVisible(false)
        window.dispatchEvent(new CustomEvent(PUSH_ENABLE_EVENT))
      } else if (next === 'denied') {
        setVisible(false)
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(false)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[60] px-3 md:bottom-6 md:px-4',
        className,
      )}
      data-testid="push-soft-prompt-banner"
      role="region"
      aria-label={getUIText('pushSoftPrompt_title', language)}
    >
      <div className="mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-lg shadow-slate-900/10">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-mint/15 text-brand-navy">
          <Bell className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900 leading-snug">
            {getUIText('pushSoftPrompt_title', language)}
          </p>
          <p className="text-xs text-slate-500 mt-0.5 leading-snug">
            {getUIText('pushSoftPrompt_body', language)}
          </p>
        </div>
        <Button
          type="button"
          variant="brand"
          className="h-11 shrink-0 rounded-xl px-3 text-xs font-medium min-h-11 min-w-[44px]"
          disabled={busy}
          onClick={() => void enable()}
          data-testid="push-soft-prompt-enable"
        >
          {getUIText('pushSoftPrompt_cta', language)}
        </Button>
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 min-h-11 min-w-11 hover:bg-slate-100 hover:text-slate-700"
          aria-label={getUIText('pushSoftPrompt_dismiss', language)}
          data-testid="push-soft-prompt-dismiss"
          onClick={dismiss}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
