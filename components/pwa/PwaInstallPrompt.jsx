'use client'

import { useI18n } from '@/contexts/i18n-context'
import { usePwaInstall } from '@/hooks/use-pwa-install'
import { PwaInstallSheet } from '@/components/pwa/PwaInstallSheet'
import { useIsMobile } from '@/hooks/use-mobile'

/**
 * Global smart PWA install prompt (Stage 169.4 / 200.81) — mobile only.
 */
export function PwaInstallPrompt() {
  const isMobile = useIsMobile()
  const { language } = useI18n()
  const {
    isOpen,
    platform,
    installBucket,
    install,
    dismissSnooze,
    dismissForever,
  } = usePwaInstall()

  if (!isMobile) return null

  return (
    <PwaInstallSheet
      open={isOpen}
      platform={platform}
      installBucket={installBucket}
      language={language}
      onInstall={install}
      onSnooze={dismissSnooze}
      onNever={dismissForever}
      onBackdropClick={() => dismissSnooze('backdrop')}
    />
  )
}
