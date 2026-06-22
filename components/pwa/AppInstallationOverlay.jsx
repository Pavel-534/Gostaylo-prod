'use client'

import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'

/**
 * Fullscreen install progress — covers browser chrome during native prompt (Samsung / Chrome).
 */
export function AppInstallationOverlay({ open, language = 'ru' }) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-white/90 backdrop-blur-md"
      role="alertdialog"
      aria-modal="true"
      aria-live="polite"
      aria-busy="true"
      data-testid="pwa-install-overlay"
    >
      <div className="flex max-w-sm flex-col items-center gap-5 px-8 text-center">
        <div
          className={cn(
            'h-12 w-12 rounded-full border-[3px] border-brand-mint border-t-brand',
            'animate-spin',
          )}
          aria-hidden
        />
        <div>
          <p className="text-lg font-semibold tracking-tight text-slate-900">
            {getUIText('pwaInstall_overlayTitle', language)}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {getUIText('pwaInstall_overlaySubtitle', language)}
          </p>
        </div>
      </div>
    </div>
  )
}
