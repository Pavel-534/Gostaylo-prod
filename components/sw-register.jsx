'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/contexts/i18n-context'
import { registerAppServiceWorker } from '@/lib/pwa/register-app-sw.js'
import { SW_MESSAGE_SKIP_WAITING } from '@/lib/pwa/service-worker-messages.js'
import { getUIText } from '@/lib/translations'

const SW_UPDATE_TOAST_ID = 'airento-sw-update'

/**
 * Early unified SW registration (push + static cache) + non-intrusive update prompt (Stage 171.17).
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

    const showUpdateToast = (/** @type {ServiceWorker} */ waitingWorker) => {
      if (disposed || updateToastShownRef.current) return
      updateToastShownRef.current = true

      const lang = languageRef.current
      toast(getUIText('pwaSwUpdate_message', lang), {
        id: SW_UPDATE_TOAST_ID,
        description: getUIText('pwaSwUpdate_subtitle', lang),
        position: 'bottom-center',
        duration: Infinity,
        classNames: {
          toast:
            'group rounded-2xl border border-slate-200/90 bg-white text-slate-900 shadow-lg shadow-slate-900/10 mb-20 sm:mb-4',
          title: 'text-slate-900 font-semibold',
          description: 'text-slate-600 text-sm',
        },
        action: {
          label: getUIText('pwaSwUpdate_action', lang),
          onClick: () => {
            pendingReloadRef.current = true
            waitingWorker.postMessage({ type: SW_MESSAGE_SKIP_WAITING })
            toast.dismiss(SW_UPDATE_TOAST_ID)
          },
        },
        cancel: {
          label: getUIText('pwaSwUpdate_dismiss', lang),
          onClick: () => {
            updateToastShownRef.current = false
          },
        },
      })
    }

    const watchWorker = (/** @type {ServiceWorker | null} */ worker) => {
      if (!worker) return
      worker.addEventListener('statechange', () => {
        if (worker.state !== 'installed') return
        if (navigator.serviceWorker.controller) {
          showUpdateToast(worker)
        } else {
          worker.postMessage({ type: SW_MESSAGE_SKIP_WAITING })
        }
      })
    }

    const bindRegistration = (/** @type {ServiceWorkerRegistration} */ registration) => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        showUpdateToast(registration.waiting)
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
