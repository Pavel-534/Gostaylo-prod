'use client'

/**
 * Stage M1.1 / 189.36 / 189.37 — Soft CTA for Notification permission (gesture-first).
 * States: default → enable; granted → status; denied → open settings / guide.
 * Resume: re-read permission on focus/visibility; transition to granted → PUSH_ENABLE_EVENT
 * (FCM subscribe-on-resume SSOT is PushClientInit + shouldSyncPushOnResume).
 */

import { useCallback, useEffect, useState } from 'react'
import { Bell, BellOff, CheckCircle2, Settings } from 'lucide-react'
import { useI18n } from '@/contexts/i18n-context'
import { useAuth } from '@/contexts/auth-context'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
  MOBILE_FLAT_CARD_HEADER_CLASS,
} from '@/lib/ui/mobile-flat-canvas'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PUSH_ENABLE_EVENT } from '@/lib/push/web-push-client-state.js'
import {
  detectNotificationSettingsPlatform,
  openNotificationPermissionSettings,
} from '@/lib/push/open-notification-settings.js'
import { getWebPushUnavailableReason } from '@/lib/push/web-push-platform.js'
import { usePwaInstall } from '@/hooks/use-pwa-install'

function readPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

function deniedGuideKey(platform) {
  if (platform === 'android') return 'pushEnable_deniedGuideAndroid'
  if (platform === 'ios') return 'pushEnable_deniedGuideIos'
  return 'pushEnable_deniedGuideOther'
}

export function PushEnableSettingsCard({ className }) {
  const { language } = useI18n()
  const { user } = useAuth()
  const { install, isStandalone } = usePwaInstall()
  const [permission, setPermission] = useState('unsupported')
  const [busy, setBusy] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [settingsPlatform, setSettingsPlatform] = useState('other')
  const [unavailableReason, setUnavailableReason] = useState(null)

  useEffect(() => {
    setPermission(readPermission())
    setSettingsPlatform(detectNotificationSettingsPlatform())
    setUnavailableReason(getWebPushUnavailableReason())
  }, [isStandalone])

  useEffect(() => {
    const refresh = () => {
      const next = readPermission()
      setPermission((prev) => {
        if (prev !== 'granted' && next === 'granted') {
          window.dispatchEvent(new CustomEvent(PUSH_ENABLE_EVENT))
        }
        return next
      })
      if (next === 'granted') setShowGuide(false)
    }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  const enable = useCallback(async () => {
    if (!user?.id || typeof window === 'undefined' || !('Notification' in window)) return
    if (getWebPushUnavailableReason() === 'ios_browser_tab') return
    setBusy(true)
    try {
      const next = await Notification.requestPermission()
      setPermission(next)
      if (next === 'granted') {
        window.dispatchEvent(new CustomEvent(PUSH_ENABLE_EVENT))
      }
    } catch {
      setPermission(readPermission())
    } finally {
      setBusy(false)
    }
  }, [user?.id])

  const openSettings = useCallback(() => {
    const result = openNotificationPermissionSettings()
    if (result === 'guide') {
      setShowGuide(true)
    } else {
      // Android intent may leave the page; still show guide as fallback when user returns.
      setShowGuide(true)
    }
  }, [])

  if (!user?.id) return null
  if (permission === 'unsupported') return null

  if (unavailableReason === 'ios_browser_tab') {
    return (
      <Card className={cn(MOBILE_FLAT_CARD_CLASS, className)} data-testid="push-enable-ios-install">
        <CardHeader className={MOBILE_FLAT_CARD_HEADER_CLASS}>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-slate-400" aria-hidden />
            {getUIText('pushEnable_iosInstallTitle', language)}
          </CardTitle>
          <CardDescription>{getUIText('pushEnable_iosInstallBody', language)}</CardDescription>
        </CardHeader>
        <CardContent className={MOBILE_FLAT_CARD_CONTENT_CLASS}>
          <Button
            type="button"
            variant="brand"
            className="w-full min-h-[44px] rounded-2xl"
            onClick={() => void install({ direct: true })}
            data-testid="push-enable-ios-install-cta"
          >
            {getUIText('pushEnable_iosInstallCta', language)}
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (permission === 'granted') {
    return (
      <Card className={cn(MOBILE_FLAT_CARD_CLASS, className)} data-testid="push-enable-granted">
        <CardContent
          className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'flex items-center gap-3 py-4')}
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900">
              {getUIText('pushEnable_grantedTitle', language)}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {getUIText('pushEnable_grantedHint', language)}
            </p>
          </div>
          <span
            className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
            data-testid="push-enable-granted-status"
          >
            {getUIText('pushEnable_grantedStatus', language)}
          </span>
        </CardContent>
      </Card>
    )
  }

  if (permission === 'denied') {
    return (
      <Card className={cn(MOBILE_FLAT_CARD_CLASS, className)} data-testid="push-enable-denied">
        <CardHeader className={MOBILE_FLAT_CARD_HEADER_CLASS}>
          <CardTitle className="text-base flex items-center gap-2">
            <BellOff className="h-4 w-4 text-slate-400" aria-hidden />
            {getUIText('pushEnable_deniedTitle', language)}
          </CardTitle>
          <CardDescription>{getUIText('pushEnable_deniedHint', language)}</CardDescription>
        </CardHeader>
        <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'space-y-3')}>
          <Button
            type="button"
            variant="brand"
            className="w-full min-h-[44px] rounded-2xl"
            onClick={openSettings}
            data-testid="push-enable-open-settings"
          >
            <Settings className="h-4 w-4 mr-2" aria-hidden />
            {getUIText('pushEnable_deniedCta', language)}
          </Button>
          {showGuide ? (
            <p
              className="text-xs text-slate-500 leading-relaxed"
              data-testid="push-enable-denied-guide"
            >
              {getUIText(deniedGuideKey(settingsPlatform), language)}
            </p>
          ) : null}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn(MOBILE_FLAT_CARD_CLASS, className)} data-testid="push-enable-card">
      <CardHeader className={MOBILE_FLAT_CARD_HEADER_CLASS}>
        <CardTitle className="text-base">{getUIText('pushEnable_title', language)}</CardTitle>
        <CardDescription>{getUIText('pushEnable_body', language)}</CardDescription>
      </CardHeader>
      <CardContent className={MOBILE_FLAT_CARD_CONTENT_CLASS}>
        <Button
          type="button"
          variant="brand"
          className="w-full min-h-[44px] rounded-2xl"
          disabled={busy}
          onClick={() => void enable()}
          data-testid="push-enable-cta"
        >
          <Bell className="h-4 w-4 mr-2" aria-hidden />
          {getUIText('pushEnable_cta', language)}
        </Button>
      </CardContent>
    </Card>
  )
}
