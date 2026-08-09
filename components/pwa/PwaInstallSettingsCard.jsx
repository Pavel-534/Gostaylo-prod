'use client'

import { Smartphone, CheckCircle2, ChevronRight } from 'lucide-react'
import { useI18n } from '@/contexts/i18n-context'
import { usePwaInstall } from '@/hooks/use-pwa-install'
import { getUIText } from '@/lib/translations'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
  MOBILE_FLAT_CARD_HEADER_CLASS,
} from '@/lib/ui/mobile-flat-canvas'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Settings / profile entry — always available when not standalone (Stage 200.81).
 */
export function PwaInstallSettingsCard({ className }) {
  const { language } = useI18n()
  const isMobile = useIsMobile()
  const { openManualPrompt, isStandalone, installBucket, canNativeInstall } = usePwaInstall()

  if (!isMobile) {
    return (
      <Card className={cn(MOBILE_FLAT_CARD_CLASS, className)} data-testid="pwa-install-settings-desktop">
        <CardHeader className={MOBILE_FLAT_CARD_HEADER_CLASS}>
          <CardTitle className="text-base">{getUIText('pwaInstall_settingsTitle', language)}</CardTitle>
          <CardDescription>{getUIText('pwaInstall_settingsDesktopHint', language)}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (isStandalone) {
    return (
      <Card className={cn(MOBILE_FLAT_CARD_CLASS, className)} data-testid="pwa-install-settings-installed">
        <CardContent
          className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'flex items-center gap-3 py-4')}
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900">
              {getUIText('pwaInstall_settingsInstalled', language)}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {getUIText('pwaInstall_settingsInstalledHint', language)}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const hintKey =
    installBucket === 'android_native' || canNativeInstall
      ? 'pwaInstall_settingsHintAndroid'
      : installBucket === 'ios_safari' || installBucket === 'ios_other'
        ? 'pwaInstall_settingsHintIos'
        : 'pwaInstall_settingsHintAndroid'

  return (
    <Card className={cn(MOBILE_FLAT_CARD_CLASS, className)} data-testid="pwa-install-settings-card">
      <CardHeader className={MOBILE_FLAT_CARD_HEADER_CLASS}>
        <CardTitle className="text-base">{getUIText('pwaInstall_settingsTitle', language)}</CardTitle>
        <CardDescription>{getUIText(hintKey, language)}</CardDescription>
      </CardHeader>
      <CardContent className={MOBILE_FLAT_CARD_CONTENT_CLASS}>
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left',
            'min-h-[44px] transition hover:bg-slate-50 active:bg-slate-100',
          )}
          onClick={() => openManualPrompt('settings')}
          data-testid="pwa-install-settings-cta"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Smartphone className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-900">
              {getUIText('pwaInstall_settingsCta', language)}
            </span>
            <span className="block text-xs text-slate-500 mt-0.5">
              {getUIText('pwaInstall_settingsCtaHint', language)}
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
        </button>
      </CardContent>
    </Card>
  )
}
