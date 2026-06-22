'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useIsMobile } from '@/hooks/use-mobile'
import { PWA_INSTALL_OVERLAY_TIMEOUT_MS, PWA_PROMPT_DELAY_MS } from '@/lib/pwa/constants.js'
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
 * PWA install controller — beforeinstallprompt, overlay, home banner direct install (Stage 169.4+).
 */
export function usePwaInstallController() {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const [isOpen, setIsOpen] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)
  const [platform, setPlatform] = useState('unsupported')
  const [canNativeInstall, setCanNativeInstall] = useState(false)
  const deferredPromptRef = useRef(null)
  const scheduledRef = useRef(null)
  const installingTimeoutRef = useRef(null)

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
      stopInstallingOverlay()
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
  }, [isMobile, stopInstallingOverlay])

  useEffect(() => () => clearInstallingTimeout(), [clearInstallingTimeout])

  const buildAnalyticsProps = useCallback(
    (extra = {}) => {
      const engagement = readPwaEngagement()
      return {
        platform: detectPwaInstallPlatform(),
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
  }, [])

  const openPrompt = useCallback(
    (source = 'engagement') => {
      markPwaPromptShown()
      markPwaPromptShownThisSession()
      setIsOpen(true)
      void trackProductEvent(
        ProductAnalyticsEvents.PWA_PROMPT_SHOWN,
        buildAnalyticsProps({ source }),
      )
    },
    [buildAnalyticsProps],
  )

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

    scheduledRef.current = setTimeout(() => {
      if (isPwaPromptDeferred()) return
      if (isStandaloneDisplayMode()) return
      const again = readPwaPromptEligibility()
      if (!again.eligible) return
      const currentPlatform = detectPwaInstallPlatform()
      if (currentPlatform === 'android' && !deferredPromptRef.current) return
      openPrompt('engagement')
    }, PWA_PROMPT_DELAY_MS)

    return () => {
      if (scheduledRef.current) {
        clearTimeout(scheduledRef.current)
        scheduledRef.current = null
      }
    }
  }, [isMobile, isOpen, pathname, canNativeInstall, openPrompt])

  useEffect(() => {
    if (!canNativeInstall || !isMobile) return
    if (isOpen || isStandaloneDisplayMode()) return
    if (isExcludedPath(pathname)) return
    const eligibility = readPwaPromptEligibility()
    if (!eligibility.eligible) return
    if (scheduledRef.current) clearTimeout(scheduledRef.current)
    scheduledRef.current = setTimeout(() => {
      if (isPwaPromptDeferred()) return
      openPrompt('engagement')
    }, PWA_PROMPT_DELAY_MS)
    return () => {
      if (scheduledRef.current) {
        clearTimeout(scheduledRef.current)
        scheduledRef.current = null
      }
    }
  }, [canNativeInstall, isMobile, isOpen, pathname, openPrompt])

  const install = useCallback(
    async (options = {}) => {
      const direct = options?.direct === true
      const plat = detectPwaInstallPlatform()

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
            })
          } else {
            stopInstallingOverlay()
            void trackProductEvent(ProductAnalyticsEvents.PWA_PROMPT_DISMISSED, {
              ...buildAnalyticsProps({ source: direct ? 'home_banner' : 'sheet' }),
              reason: 'native_declined',
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

      if (plat === 'ios') {
        if (direct) {
          openPrompt('home_banner')
          return
        }
        void trackProductEvent(ProductAnalyticsEvents.PWA_PROMPT_ACCEPTED, {
          ...buildAnalyticsProps({ source: 'sheet' }),
          native: false,
        })
        closePrompt()
        return
      }

      if (direct) {
        openPrompt('home_banner')
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
    isInstalling,
    platform,
    canNativeInstall,
    install,
    dismissSnooze,
    dismissForever,
    closePrompt,
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
