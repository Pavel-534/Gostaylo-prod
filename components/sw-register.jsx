'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/contexts/i18n-context'
import { registerAppServiceWorker } from '@/lib/pwa/register-app-sw.js'
import { SW_MESSAGE_SKIP_WAITING } from '@/lib/pwa/service-worker-messages.js'
import { shouldShowSwUpdatePrompt } from '@/lib/pwa/client-display-channel.js'
import { isBelowCriticalRelease } from '@/lib/pwa/release-version.js'
import { PwaSwUpdateToast } from '@/components/pwa/PwaSwUpdateToast'

const SW_UPDATE_TOAST_ID = 'airento-sw-update'

/**
 * Silent SW by default (Stage 175). Toast only for critical release + PWA/mobile.
 */
export function SwRegister() {
  const { language } = useI18n()
  const languageRef = useRef(language)
  const updateToastShownRef = useRef(false)
  const pendingReloadRef = useRef(false)

  useEffect(() => {
    languageRef.current = language
  }, [language])

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return undefined

    let disposed = false

    const onControllerChange = () => {
      if (!pendingReloadRef.current || disposed) return
      pendingReloadRef.current = false
      window.location.reload()
    }

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    const maybeShowCriticalUpdateToast = (/** @type {ServiceWorker} */ waitingWorker) => {
      if (disposed || updateToastShownRef.current) return
      if (!shouldShowSwUpdatePrompt()) return
      if (!isBelowCriticalRelease()) return

      updateToastShownRef.current = true
      const lang = languageRef.current

      toast.custom(
        (toastId) => (
          <PwaSwUpdateToast
            toastId={toastId}
            language={lang}
            waitingWorker={waitingWorker}
            onDismiss={() => {
              updateToastShownRef.current = false
            }}
            onUpdateStart={() => {
              pendingReloadRef.current = true
            }}
          />
        ),
        {
          id: SW_UPDATE_TOAST_ID,
          position: 'bottom-center',
          duration: Infinity,
          unstyled: true,
          classNames: {
            toast: '!bg-transparent !border-0 !shadow-none !p-0 mb-20 sm:mb-4',
          },
        },
      )
    }

    const watchWorker = (/** @type {ServiceWorker | null} */ worker) => {
      if (!worker) return
      worker.addEventListener('statechange', () => {
        if (worker.state !== 'installed') return
        if (!navigator.serviceWorker.controller) {
          // First install — activate without user prompt.
          worker.postMessage({ type: SW_MESSAGE_SKIP_WAITING })
        }
        // `waiting` + existing controller: silent — no skipWaiting, no toast (unless critical).
        else if (isBelowCriticalRelease()) {
          maybeShowCriticalUpdateToast(worker)
        }
      })
    }

    const bindRegistration = (/** @type {ServiceWorkerRegistration} */ registration) => {
      if (registration.waiting && navigator.serviceWorker.controller && isBelowCriticalRelease()) {
        maybeShowCriticalUpdateToast(registration.waiting)
      }

      registration.addEventListener('updatefound', () => {
        watchWorker(registration.installing)
      })

      if (registration.installing) {
        watchWorker(registration.installing)
      }
    }

    const onFocus = () => {
      if (disposed) return
      void navigator.serviceWorker.ready
        .then((registration) => registration.update())
        .catch(() => {})
    }

    window.addEventListener('focus', onFocus)

    void (async () => {
      const registration = await registerAppServiceWorker()
      if (!registration || disposed) return
      bindRegistration(registration)
    })()

    return () => {
      disposed = true
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      window.removeEventListener('focus', onFocus)
      toast.dismiss(SW_UPDATE_TOAST_ID)
    }
  }, [])

  return null
}
