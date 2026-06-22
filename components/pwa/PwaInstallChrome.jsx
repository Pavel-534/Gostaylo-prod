'use client'

import { useI18n } from '@/contexts/i18n-context'
import { usePwaInstall } from '@/hooks/use-pwa-install'
import { AppInstallationOverlay } from '@/components/pwa/AppInstallationOverlay'
import { PwaInstallPrompt } from '@/components/pwa/PwaInstallPrompt'

/** Global PWA install UI — sheet + installing overlay (SSOT mount in app/layout.js). */
export function PwaInstallChrome() {
  const { language } = useI18n()
  const { isInstalling } = usePwaInstall()

  return (
    <>
      <PwaInstallPrompt />
      <AppInstallationOverlay open={isInstalling} language={language} />
    </>
  )
}
