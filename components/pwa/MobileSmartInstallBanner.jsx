'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'
import { useI18n } from '@/contexts/i18n-context'
import { usePwaInstall } from '@/hooks/use-pwa-install'
import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'

/** Reserved mobile strip height — matches py-2.5 + 36px icon row (CLS guard). */
const BANNER_RESERVE_CLASS =
  'block md:hidden min-h-[53px] border-b border-slate-200/80 bg-white shadow-sm'

/**
 * Home-page mobile install strip (Stage 200.81).
 * `pending` reserves height via CSS (`md:hidden`) so hydration / eligibility
 * evaluation does not shift page content when the banner will show.
 */
export function MobileSmartInstallBanner() {
  const { language } = useI18n()
  const { install, bannerEligible, dismissSnooze, isStandalone, eligibilityReady } =
    usePwaInstall()
  /** `pending` | `show` | `hide` */
  const [phase, setPhase] = useState('pending')

  useEffect(() => {
    if (!eligibilityReady) return
    if (isStandalone) {
      setPhase('hide')
      return
    }
    setPhase(bannerEligible ? 'show' : 'hide')
  }, [eligibilityReady, bannerEligible, isStandalone])

  if (phase === 'hide') return null

  return (
    <div
      className={BANNER_RESERVE_CLASS}
      data-testid="pwa-smart-install-banner"
      aria-hidden={phase === 'pending' ? true : undefined}
    >
      {phase === 'show' ? (
        <div className="mx-auto flex max-w-7xl items-center gap-2.5 px-3 py-2.5 sm:px-4">
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl ring-1 ring-slate-200/90">
            <Image
              src="/icons/icon-192x192.png"
              alt=""
              width={36}
              height={36}
              className="h-full w-full object-cover"
              priority
            />
          </div>
          <p className="min-w-0 flex-1 text-xs font-medium leading-snug text-slate-700 sm:text-[13px]">
            {getUIText('pwaInstall_bannerText', language)}
          </p>
          <Button
            type="button"
            variant="brand"
            className="h-auto shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium min-h-[44px]"
            onClick={() => void install({ direct: true })}
            data-testid="pwa-smart-install-cta"
          >
            {getUIText('pwaInstall_install', language)}
          </Button>
          <button
            type="button"
            className={cn(
              'flex shrink-0 items-center justify-center rounded-full text-slate-500',
              'min-h-[44px] min-w-[44px] hover:bg-slate-100 hover:text-slate-700',
            )}
            aria-label={getUIText('pwaInstall_notNow', language)}
            data-testid="pwa-smart-install-dismiss"
            onClick={() => dismissSnooze('banner_dismiss')}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  )
}
