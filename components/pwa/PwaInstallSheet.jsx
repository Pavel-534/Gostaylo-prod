'use client'

import { Share2, Smartphone, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'

export function PwaInstallSheet({
  open,
  platform = 'android',
  language = 'ru',
  onInstall,
  onSnooze,
  onNever,
  onBackdropClick,
}) {
  if (!open) return null

  const isIos = platform === 'ios'

  return (
    <>
      <div
        className="fixed inset-0 z-[100] bg-slate-900/45 backdrop-blur-[2px] md:hidden"
        onClick={onBackdropClick}
        aria-hidden
        data-testid="pwa-install-backdrop"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={getUIText('pwaInstall_title', language)}
        data-testid="pwa-install-sheet"
        className={cn(
          'fixed inset-x-0 bottom-0 z-[101] flex flex-col rounded-t-3xl bg-white md:hidden',
          'shadow-[0_-24px_64px_rgba(15,23,42,0.22)]',
          'animate-in slide-in-from-bottom duration-300 pb-[max(1rem,env(safe-area-inset-bottom,0px))]',
        )}
      >
        <div className="flex justify-center pt-3 pb-1" aria-hidden>
          <div className="h-1 w-12 rounded-full bg-slate-200" />
        </div>

        <div className="flex items-start justify-between gap-3 px-5 pt-1">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand">
              <Smartphone className="h-6 w-6" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="font-serif text-xl font-semibold tracking-tight text-slate-900">
                {getUIText('pwaInstall_title', language)}
              </h2>
              <p className="mt-1 text-sm text-slate-600">{getUIText('pwaInstall_subtitle', language)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSnooze?.('backdrop')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600"
            aria-label={getUIText('pwaInstall_notNow', language)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ul className="mt-4 space-y-2 px-5 text-sm text-slate-700">
          <li className="flex gap-2">
            <span className="text-brand">•</span>
            {getUIText('pwaInstall_bulletSearch', language)}
          </li>
          <li className="flex gap-2">
            <span className="text-brand">•</span>
            {getUIText('pwaInstall_bulletBookings', language)}
          </li>
          <li className="flex gap-2">
            <span className="text-brand">•</span>
            {getUIText('pwaInstall_bulletPush', language)}
          </li>
        </ul>

        {isIos ? (
          <div className="mt-4 px-5">
            <p className="mb-3 text-sm font-semibold text-slate-800">
              {getUIText('pwaInstall_iosTitle', language)}
            </p>
            <ol className="space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <Share2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                {getUIText('pwaInstall_iosStep1', language)}
              </li>
              <li>{getUIText('pwaInstall_iosStep2', language)}</li>
              <li>{getUIText('pwaInstall_iosStep3', language)}</li>
            </ol>
          </div>
        ) : null}

        <div className="mt-5 flex flex-col gap-2 px-5 pb-2">
          <Button
            type="button"
            variant="brand"
            className="h-11 w-full rounded-2xl"
            onClick={onInstall}
            data-testid="pwa-install-accept"
          >
            {isIos
              ? getUIText('pwaInstall_iosGotIt', language)
              : getUIText('pwaInstall_install', language)}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-2xl border-slate-200"
            onClick={() => onSnooze?.('snooze')}
            data-testid="pwa-install-snooze"
          >
            {getUIText('pwaInstall_notNow', language)}
          </Button>
          <button
            type="button"
            className="py-2 text-center text-xs text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
            onClick={onNever}
            data-testid="pwa-install-never"
          >
            {getUIText('pwaInstall_never', language)}
          </button>
        </div>
      </div>
    </>
  )
}
