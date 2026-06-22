'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useI18n } from '@/contexts/i18n-context'
import { usePwaInstall } from '@/hooks/use-pwa-install'
import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'
import { isStandaloneDisplayMode } from '@/lib/pwa/pwa-platform'

/**
 * Home-page mobile install strip for share-link arrivals (bypasses engagement gates on tap).
 */
export function MobileSmartInstallBanner() {
  const { language } = useI18n()
  const { install } = usePwaInstall()
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    setHidden(isStandaloneDisplayMode())
  }, [])

  if (hidden) return null

  return (
    <div
      className="block border-b border-slate-200/80 bg-white shadow-sm md:hidden"
      data-testid="pwa-smart-install-banner"
    >
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
          className="h-auto shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium"
          onClick={() => void install({ direct: true })}
          data-testid="pwa-smart-install-cta"
        >
          {getUIText('pwaInstall_install', language)}
        </Button>
      </div>
    </div>
  )
}
