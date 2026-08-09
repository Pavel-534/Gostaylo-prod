'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useIsMobile } from '@/hooks/use-mobile'
import { PWA_INSTALL_OVERLAY_TIMEOUT_MS, PWA_PROMPT_DELAY_MS } from '@/lib/pwa/constants.js'
import {
  markPwaPromptShown,
  markPwaPromptShownThisSession,
  readPwaBannerEligibility,
  readPwaEngagement,
  readPwaManualPromptEligibility,
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
  resolvePwaInstallBucket,
} from '@/lib/pwa/pwa-platform.js'
import { isPwaPromptDeferred } from '@/lib/pwa/pwa-prompt-defer.js'
import { registerAppServiceWorker } from '@/lib/pwa/register-app-sw.js'
import {
  ProductAnalyticsEvents,
  trackProductEvent,
} from '@/lib/analytics/product-analytics.js'

const PwaInstallContext = createContext(null)

function isExcludedPath(pathname) {
  if (!pathname) return true
  const normalized = pathname.replace(/\/+$/, '') || '/'
  if (normalized.startsWith('/partner') || normalized.startsWith('/admin')) return true
  if (/^\/messages\/.+/.test(normalized) && normalized !== '/messages') return true
  if (normalized === '/messages') return true
  return false
}

/**
 * PWA install controller — Stage 169.4 / 200.81 (unified never/snooze, settings entry, buckets).
 */
export function usePwaInstallController() {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const [isOpen, setIsOpen] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)
  const [platform, setPlatform] = useState('unsupported')
  const [canNativeInstall, setCanNativeInstall] = useState(false)
  const [bannerEligible, setBannerEligible] = useState(false)
  /** SSR + first paint: false — hydration-safe (matches SSR). */
  const [isStandalone, setIsStandalone] = useState(false)
  /** True after first client eligibility pass (banner CLS gate). */
  const [eligibilityReady, setEligibilityReady] = useState(false)
  const deferredPromptRef = useRef(null)
  const scheduledRef = useRef(null)
  const installingTimeoutRef = useRef(null)

  const installBucket = useMemo(
    () => resolvePwaInstallBucket(canNativeInstall),
    [canNativeInstall],
  )

  const clearInstallingTimeout = useCallback(() => {
    if (installingTimeoutRef.current) {
      clearTimeout(installingTimeoutRef.current)
      installingTimeoutRef.current = null
    }
  }, [])

  const stopInstallingOverlay = useCallback(() => {
    setIsInstalling(false)
    clearInstallingTimeout()
  }, [clearInstallingTimeout])

  const startInstallingOverlay = useCallback(() => {
    setIsInstalling(true)
    clearInstallingTimeout()
    installingTimeoutRef.current = setTimeout(() => {
      setIsInstalling(false)
      installingTimeoutRef.current = null
    }, PWA_INSTALL_OVERLAY_TIMEOUT_MS)
  }, [clearInstallingTimeout])

  /** Banner eligibility — not gated on useIsMobile (CSS `md:hidden` hides on desktop). */
  const refreshBannerEligibility = useCallback(() => {
    if (typeof window === 'undefined') {
      setBannerEligible(false)
      return
    }
    if (isStandaloneDisplayMode() || !canShowPwaInstallUi()) {
      setBannerEligible(false)
      return
    }
    setBannerEligible(readPwaBannerEligibility().eligible)
  }, [])

  useEffect(() => {
    setIsStandalone(isStandaloneDisplayMode())
    setPlatform(detectPwaInstallPlatform())
    refreshBannerEligibility()
    setEligibilityReady(true)
  }, [refreshBannerEligibility])

  useEffect(() => {
    if (!isMobile) return
    recordPwaVisitDay()
    void registerAppServiceWorker()
    setPlatform(detectPwaInstallPlatform())
    setIsStandalone(isStandaloneDisplayMode())
    refreshBannerEligibility()
  }, [isMobile, refreshBannerEligibility])

  useEffect(() => {
    if (!isMobile) return

    const onBeforeInstall = (event) => {
      event.preventDefault()
      deferredPromptRef.current = event
      setCanNativeInstall(true)
    }

    const onInstalled = () => {
      stopInstallingOverlay()
      deferredPromptRef.current = null
      setCanNativeInstall(false)
      setIsOpen(false)
      setIsStandalone(true)
      refreshBannerEligibility()
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [isMobile, refreshBannerEligibility, stopInstallingOverlay])

  useEffect(() => () => clearInstallingTimeout(), [clearInstallingTimeout])

  const buildAnalyticsProps = useCallback(
    (extra = {}) => {
      const engagement = readPwaEngagement()
      return {
        platform: detectPwaInstallPlatform(),
        platform_bucket: resolvePwaInstallBucket(Boolean(deferredPromptRef.current)),
        visit_days: engagement.visitDays,
        pdp_views: engagement.pdpViews,
        map_opens: engagement.mapOpens,
        shown_count: readPwaPromptShownCount(),
        native_available: Boolean(deferredPromptRef.current),
        ...extra,
      }
    },
    [],
  )

  const closePrompt = useCallback(() => {
    setIsOpen(false)
    refreshBannerEligibility()
  }, [refreshBannerEligibility])

  const openPrompt = useCallback(
    (source = 'engagement', { force = false } = {}) => {
      if (!force) {
        const eligibility = readPwaPromptEligibility()
        if (!eligibility.eligible) return false
      } else {
        const manual = readPwaManualPromptEligibility()
        if (!manual.eligible) return false
      }
      markPwaPromptShown()
      if (!force) markPwaPromptShownThisSession()
      setIsOpen(true)
      setBannerEligible(false)
      void trackProductEvent(
        ProductAnalyticsEvents.PWA_PROMPT_SHOWN,
        buildAnalyticsProps({ source: force ? source || 'settings' : source }),
      )
      return true
    },
    [buildAnalyticsProps],
  )

  /** Settings / profile — bypasses never/snooze/session. */
  const openManualPrompt = useCallback(
    (source = 'settings') => openPrompt(source, { force: true }),
    [openPrompt],
  )

  /** Single auto-sheet scheduler (engagement + native prompt availability). */
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
    if (!eligibility.eligible) {
      refreshBannerEligibility()
      return
    }

    scheduledRef.current = setTimeout(() => {
      if (isPwaPromptDeferred()) return
      if (isStandaloneDisplayMode()) return
      const again = readPwaPromptEligibility()
      if (!again.eligible) return
      openPrompt('auto_sheet')
    }, PWA_PROMPT_DELAY_MS)

    return () => {
      if (scheduledRef.current) {
        clearTimeout(scheduledRef.current)
        scheduledRef.current = null
      }
    }
  }, [isMobile, isOpen, pathname, canNativeInstall, openPrompt, refreshBannerEligibility])

  const install = useCallback(
    async (options = {}) => {
      const direct = options?.direct === true
      const plat = detectPwaInstallPlatform()
      const bucket = resolvePwaInstallBucket(Boolean(deferredPromptRef.current))

      if (plat === 'android' && deferredPromptRef.current) {
        closePrompt()
        startInstallingOverlay()
        try {
          await deferredPromptRef.current.prompt()
          const choice = await deferredPromptRef.current.userChoice
          if (choice?.outcome === 'accepted') {
            void trackProductEvent(ProductAnalyticsEvents.PWA_PROMPT_ACCEPTED, {
              ...buildAnalyticsProps({ source: direct ? 'home_banner' : 'sheet' }),
              native: true,
              platform_bucket: bucket,
            })
          } else {
            stopInstallingOverlay()
            void trackProductEvent(ProductAnalyticsEvents.PWA_PROMPT_DISMISSED, {
              ...buildAnalyticsProps({ source: direct ? 'home_banner' : 'sheet' }),
              reason: 'native_declined',
              platform_bucket: bucket,
            })
            if (!direct) {
              snoozePwaPrompt()
              closePrompt()
            }
          }
        } catch {
          stopInstallingOverlay()
          if (!direct) {
            snoozePwaPrompt()
            closePrompt()
          }
        }
        deferredPromptRef.current = null
        setCanNativeInstall(false)
        return
      }

      if (plat === 'ios' || bucket === 'android_manual') {
        if (direct) {
          openPrompt('home_banner', { force: true })
          return
        }
        void trackProductEvent(ProductAnalyticsEvents.PWA_PROMPT_ACCEPTED, {
          ...buildAnalyticsProps({ source: 'sheet' }),
          native: false,
          platform_bucket: bucket,
          outcome: 'got_it',
        })
        snoozePwaPrompt()
        closePrompt()
        return
      }

      if (direct) {
        openPrompt('home_banner', { force: true })
      }
    },
    [buildAnalyticsProps, closePrompt, openPrompt, startInstallingOverlay, stopInstallingOverlay],
  )

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

  /** Accidental backdrop — session only, no 5d snooze. */
  const dismissSession = useCallback(
    (reason = 'session') => {
      markPwaPromptShownThisSession()
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
      reason: 'long_snooze',
    })
    closePrompt()
  }, [buildAnalyticsProps, closePrompt])

  return {
    isOpen,
    isInstalling,
    platform,
    installBucket,
    canNativeInstall,
    bannerEligible,
    eligibilityReady,
    isStandalone,
    install,
    dismissSnooze,
    dismissSession,
    dismissForever,
    closePrompt,
    openManualPrompt,
    refreshBannerEligibility,
  }
}

export function PwaInstallProvider({ children }) {
  const value = usePwaInstallController()
  return <PwaInstallContext.Provider value={value}>{children}</PwaInstallContext.Provider>
}

/** @returns {ReturnType<typeof usePwaInstallController>} */
export function usePwaInstall() {
  const ctx = useContext(PwaInstallContext)
  if (!ctx) {
    throw new Error('usePwaInstall must be used within PwaInstallProvider')
  }
  return ctx
}
