'use client'

/**
 * Stage M1.1 — Web Push (FCM) bootstrap after login on any shell that mounts this.
 * - Runs only when `user?.id` is present.
 * - `permission === granted` → getToken + register (idempotent across storefront/chat remounts).
 * - `default` → no auto `requestPermission` (gesture / Soft CTA via PUSH_ENABLE_EVENT).
 * - `denied` → silent no-op.
 */

import { useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { getFirebaseAppSafe, getFirebaseVapidKey } from '@/lib/firebase-web'
import { postPushAction } from '@/lib/api/push-client'
import { registerAppServiceWorker } from '@/lib/pwa/register-app-sw.js'
import {
  PUSH_ENABLE_EVENT,
  PUSH_FCM_TOKEN_KEY,
  PUSH_REGISTERED_UID_KEY,
  getSessionPushSync,
  setSessionPushSync,
} from '@/lib/push/web-push-client-state.js'

/** Cross-mount in-flight guard (same uid). */
let syncInFlightUid = null

export function PushClientInit() {
  const { user } = useAuth()
  const aliveRef = useRef(true)
  const busyRef = useRef(false)

  useEffect(() => {
    aliveRef.current = true
    if (!user?.id) return
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return

    let unsubscribeOnMessage = null
    let swMessageHandler = null
    let pingInterval = null

    const deviceInfo = {
      surface: 'web',
      userAgent: navigator.userAgent || '',
      platform: navigator.platform || '',
      language: navigator.language || '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    }

    const clearMessagingSide = () => {
      if (pingInterval != null) {
        clearInterval(pingInterval)
        pingInterval = null
      }
      if (typeof unsubscribeOnMessage === 'function') {
        unsubscribeOnMessage()
        unsubscribeOnMessage = null
      }
      if (swMessageHandler) {
        navigator.serviceWorker.removeEventListener('message', swMessageHandler)
        swMessageHandler = null
      }
    }

    const syncTokenToServer = async (token, userId, update, attempt = 0) => {
      const { ok, json, status } = await postPushAction({
        action: 'register',
        token,
        deviceInfo,
        ...(update ? { update: true } : {}),
      })
      if (!aliveRef.current) return false
      if (ok) {
        try {
          localStorage.setItem(PUSH_FCM_TOKEN_KEY, token)
          sessionStorage.setItem(PUSH_REGISTERED_UID_KEY, String(userId))
        } catch {
          /* ignore */
        }
        setSessionPushSync(userId, token)
        console.info('Push Debug: Token synchronized with database')
        return true
      }
      console.warn('Push Debug: register failed', status, json?.error || json)
      if (attempt < 1) {
        await new Promise((r) => setTimeout(r, 5000))
        if (!aliveRef.current) return false
        console.info('Push Debug: retrying register after 5s…')
        return syncTokenToServer(token, userId, update, attempt + 1)
      }
      return false
    }

    const run = async ({ forceRefresh = false } = {}) => {
      if (busyRef.current) return
      const userId = user.id
      if (syncInFlightUid === String(userId)) return

      if (Notification.permission === 'denied') return
      if (Notification.permission !== 'granted') {
        console.info('Push Debug: permission not granted — waiting for Soft CTA / gesture')
        return
      }

      busyRef.current = true
      syncInFlightUid = String(userId)
      try {
        const app = getFirebaseAppSafe()
        const vapidKey = getFirebaseVapidKey()
        if (!app || !vapidKey) {
          console.warn(
            'Push Debug: Firebase config or NEXT_PUBLIC_FIREBASE_VAPID_KEY is missing; push disabled',
          )
          return
        }

        await registerAppServiceWorker()
        if (!aliveRef.current) return

        const reg = await navigator.serviceWorker.ready
        if (!aliveRef.current) return
        console.info('[Push Debug] Service Worker READY. Starting token sync…')

        try {
          const prevUid = sessionStorage.getItem(PUSH_REGISTERED_UID_KEY)
          if (prevUid && prevUid !== String(userId)) {
            forceRefresh = true
          }
        } catch {
          /* ignore */
        }

        const { isSupported, getMessaging, getToken, onMessage } = await import('firebase/messaging')
        if (!(await isSupported())) {
          console.warn('Push Debug: Firebase messaging not supported in this browser')
          return
        }
        if (!aliveRef.current) return

        const messaging = getMessaging(app)
        const token = await getToken(messaging, {
          vapidKey,
          serviceWorkerRegistration: reg,
          forceRefresh,
        })
        if (!aliveRef.current || !token) return

        let stored = ''
        try {
          stored = localStorage.getItem(PUSH_FCM_TOKEN_KEY) || ''
        } catch {
          stored = ''
        }

        const synced = getSessionPushSync()
        const alreadySynced =
          synced.uid === String(userId) && synced.token === token && stored === token

        if (!alreadySynced) {
          const storageMismatch = Boolean(stored && stored !== token)
          if (storageMismatch) {
            console.info(
              'Push Debug: localStorage token ≠ Firebase getToken — register with update:true',
            )
          }
          await syncTokenToServer(token, userId, storageMismatch)
          if (!aliveRef.current) return
        } else {
          console.info('Push Debug: skip duplicate register (same uid+token)')
        }

        clearMessagingSide()
        pingInterval = setInterval(() => {
          void postPushAction({ action: 'ping', token }).catch(() => {})
        }, 30_000)

        unsubscribeOnMessage = onMessage(messaging, (payload) => {
          const data = payload?.data || {}
          window.dispatchEvent(new CustomEvent('gostaylo:push-message', { detail: data }))
        })

        swMessageHandler = (e) => {
          const d = e?.data
          if (!d || d.type !== 'gostaylo_push') return
          window.dispatchEvent(new CustomEvent('gostaylo:push-message', { detail: d.payload || {} }))
        }
        navigator.serviceWorker.addEventListener('message', swMessageHandler)
      } catch (e) {
        if (aliveRef.current) {
          console.warn('Push Debug: init error', e?.message || e)
        }
      } finally {
        busyRef.current = false
        if (syncInFlightUid === String(userId)) syncInFlightUid = null
      }
    }

    const onEnable = () => {
      void run({ forceRefresh: true })
    }

    void run()
    window.addEventListener(PUSH_ENABLE_EVENT, onEnable)

    return () => {
      aliveRef.current = false
      window.removeEventListener(PUSH_ENABLE_EVENT, onEnable)
      clearMessagingSide()
    }
  }, [user?.id])

  return null
}
