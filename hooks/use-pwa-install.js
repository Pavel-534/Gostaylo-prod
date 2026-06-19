'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useIsMobile } from '@/hooks/use-mobile'
import { PWA_PROMPT_DELAY_MS } from '@/lib/pwa/constants.js'
import {
  markPwaPromptShown,
  markPwaPromptShownThisSession,
  readPwaEngagement,
  readPwaPromptEligibility,
  readPwaPromptShownCount,
  recordPwaVisitDay,
  setPwaPromptNever,
  snoozePwaPrompt,
} from '@/lib/pwa/pwa-install-storage.js'
import {
  canShowPwaInstallUi,
  detectPwaInstallPlatform,
  isStandaloneDisplayMode,
} from '@/lib/pwa/pwa-platform.js'
import { isPwaPromptDeferred } from '@/lib/pwa/pwa-prompt-defer.js'
import { registerAppServiceWorker } from '@/lib/pwa/register-app-sw.js'
import {
  ProductAnalyticsEvents,
  trackProductEvent,
} from '@/lib/analytics/product-analytics.js'

function isExcludedPath(pathname) {
  if (!pathname) return true
  const normalized = pathname.replace(/\/+$/, '') || '/'
  if (normalized.startsWith('/partner') || normalized.startsWith('/admin')) return true
  if (/^\/messages\/.+/.test(normalized) && normalized !== '/messages') return true
  if (normalized === '/messages') return true
  return false
}

/**
 * Smart PWA install prompt — beforeinstallprompt + iOS A2HS (Stage 169.4).
 */
export function usePwaInstall() {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const [isOpen, setIsOpen] = useState(false)
  const [platform, setPlatform] = useState('unsupported')
  const [canNativeInstall, setCanNativeInstall] = useState(false)
  const deferredPromptRef = useRef(null)
  const scheduledRef = useRef(null)

  useEffect(() => {
    if (!isMobile) return
    recordPwaVisitDay()
    void registerAppServiceWorker()
    setPlatform(detectPwaInstallPlatform())
  }, [isMobile])

  useEffect(() => {
    if (!isMobile) return

    const onBeforeInstall = (event) => {
      event.preventDefault()
      deferredPromptRef.current = event
      setCanNativeInstall(true)
    }

    const onInstalled = () => {
      deferredPromptRef.current = null
      setCanNativeInstall(false)
      setIsOpen(false)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [isMobile])

  const buildAnalyticsProps = useCallback(() => {
    const engagement = readPwaEngagement()
    return {
      platform: detectPwaInstallPlatform(),
      visit_days: engagement.visitDays,
      pdp_views: engagement.pdpViews,
      map_opens: engagement.mapOpens,
      shown_count: readPwaPromptShownCount(),
      native_available: Boolean(deferredPromptRef.current),
    }
  }, [])

  const closePrompt = useCallback(() => {
    setIsOpen(false)
  }, [])

  const openPrompt = useCallback(() => {
    markPwaPromptShown()
    markPwaPromptShownThisSession()
    setIsOpen(true)
    void trackProductEvent(ProductAnalyticsEvents.PWA_PROMPT_SHOWN, buildAnalyticsProps())
  }, [buildAnalyticsProps])

  useEffect(() => {
    if (scheduledRef.current) {
      clearTimeout(scheduledRef.current)
      scheduledRef.current = null
    }

    if (!isMobile || isOpen) return
    if (isStandaloneDisplayMode()) return
    if (!canShowPwaInstallUi()) return
    if (isExcludedPath(pathname)) return

    const eligibility = readPwaPromptEligibility()
    if (!eligibility.eligible) return

    // Android: wait for native prompt when possible; iOS always eligible on engagement.
    const plat = detectPwaInstallPlatform()
    if (plat === 'android' && !deferredPromptRef.current) {
      // Still allow showing after delay if engagement met — user may get manual browser menu hint
      // but primarily we wait for beforeinstallprompt; schedule recheck.
    }

    scheduledRef.current = setTimeout(() => {
      if (isPwaPromptDeferred()) return
      if (isStandaloneDisplayMode()) return
      const again = readPwaPromptEligibility()
      if (!again.eligible) return
      const currentPlatform = detectPwaInstallPlatform()
      if (currentPlatform === 'android' && !deferredPromptRef.current) return
      openPrompt()
    }, PWA_PROMPT_DELAY_MS)

    return () => {
      if (scheduledRef.current) {
        clearTimeout(scheduledRef.current)
        scheduledRef.current = null
      }
    }
  }, [isMobile, isOpen, pathname, canNativeInstall, openPrompt])

  // Re-run scheduling when beforeinstallprompt arrives
  useEffect(() => {
    if (!canNativeInstall || !isMobile) return
    if (isOpen || isStandaloneDisplayMode()) return
    if (isExcludedPath(pathname)) return
    const eligibility = readPwaPromptEligibility()
    if (!eligibility.eligible) return
    if (scheduledRef.current) clearTimeout(scheduledRef.current)
    scheduledRef.current = setTimeout(() => {
      if (isPwaPromptDeferred()) return
      openPrompt()
    }, PWA_PROMPT_DELAY_MS)
    return () => {
      if (scheduledRef.current) {
        clearTimeout(scheduledRef.current)
        scheduledRef.current = null
      }
    }
  }, [canNativeInstall, isMobile, isOpen, pathname, openPrompt])

  const install = useCallback(async () => {
    const plat = detectPwaInstallPlatform()
    if (plat === 'android' && deferredPromptRef.current) {
      try {
        await deferredPromptRef.current.prompt()
        const choice = await deferredPromptRef.current.userChoice
        if (choice?.outcome === 'accepted') {
          void trackProductEvent(ProductAnalyticsEvents.PWA_PROMPT_ACCEPTED, {
            ...buildAnalyticsProps(),
            native: true,
          })
          closePrompt()
        } else {
          void trackProductEvent(ProductAnalyticsEvents.PWA_PROMPT_DISMISSED, {
            ...buildAnalyticsProps(),
            reason: 'native_declined',
          })
          snoozePwaPrompt()
          closePrompt()
        }
      } catch {
        snoozePwaPrompt()
        closePrompt()
      }
      deferredPromptRef.current = null
      setCanNativeInstall(false)
      return
    }

    // iOS — instructions only; count as accepted intent
    void trackProductEvent(ProductAnalyticsEvents.PWA_PROMPT_ACCEPTED, {
      ...buildAnalyticsProps(),
      native: false,
    })
    closePrompt()
  }, [buildAnalyticsProps, closePrompt])

  const dismissSnooze = useCallback(
    (reason = 'snooze') => {
      snoozePwaPrompt()
      void trackProductEvent(ProductAnalyticsEvents.PWA_PROMPT_DISMISSED, {
        ...buildAnalyticsProps(),
        reason,
      })
      closePrompt()
    },
    [buildAnalyticsProps, closePrompt],
  )

  const dismissForever = useCallback(() => {
    setPwaPromptNever()
    void trackProductEvent(ProductAnalyticsEvents.PWA_PROMPT_DISMISSED, {
      ...buildAnalyticsProps(),
      reason: 'never',
    })
    closePrompt()
  }, [buildAnalyticsProps, closePrompt])

  return {
    isOpen,
    platform,
    canNativeInstall,
    install,
    dismissSnooze,
    dismissForever,
    closePrompt,
  }
}
