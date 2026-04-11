'use client'

/**
 * Инициализация Web Push (FCM): один цикл на смену `user.id`, без лавины getToken/register.
 * forceRefresh — только при смене аккаунта или сразу после первого grant разрешения.
 */

import { useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { getFirebaseAppSafe, getFirebaseVapidKey } from '@/lib/firebase-web'

const PUSH_UID_KEY = 'gostaylo_push_registered_uid'

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
      const res = await fetch('/api/v2/push', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          token,
          deviceInfo,
          ...(update ? { update: true } : {}),
        }),
      })
      let json = {}
      try {
        json = await res.json()
      } catch {
        json = {}
      }
      if (!aliveRef.current) return
      const ok = res.ok && json.success !== false
      if (ok) {
        try {
          localStorage.setItem('gostaylo_fcm_token', token)
          sessionStorage.setItem(PUSH_UID_KEY, String(userId))
        } catch {
          /* ignore */
        }
        console.info('Push Debug: Token synchronized with database')
        return
      }
      console.warn('Push Debug: register failed', res.status, json?.error || json)
      if (attempt < 1) {
        await new Promise((r) => setTimeout(r, 5000))
        if (!aliveRef.current) return
        console.info('Push Debug: retrying register after 5s…')
        await syncTokenToServer(token, userId, update, attempt + 1)
      }
    }

    const run = async () => {
      if (busyRef.current) return
      busyRef.current = true
      const userId = user.id
      try {
        const app = getFirebaseAppSafe()
        const vapidKey = getFirebaseVapidKey()
        if (!app || !vapidKey) {
          console.warn(
            'Push Debug: Firebase config or NEXT_PUBLIC_FIREBASE_VAPID_KEY is missing; push disabled',
          )
          return
        }

        await navigator.serviceWorker.register('/firebase-messaging-sw.js')
        if (!aliveRef.current) return

        const reg = await navigator.serviceWorker.ready
        if (!aliveRef.current) return
        console.info('[Push Debug] Service Worker READY. Starting token sync…')

        let forceRefresh = false
        try {
          const prevUid = sessionStorage.getItem(PUSH_UID_KEY)
          if (prevUid && prevUid !== String(userId)) {
            forceRefresh = true
          }
        } catch {
          /* ignore */
        }

        if (Notification.permission === 'default') {
          const p = await Notification.requestPermission()
          if (p === 'granted') {
            forceRefresh = true
          }
        }
        if (!aliveRef.current) return
        if (Notification.permission !== 'granted') return

        clearMessagingSide()

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
          stored = localStorage.getItem('gostaylo_fcm_token') || ''
        } catch {
          stored = ''
        }
        const storageMismatch = Boolean(stored && stored !== token)
        if (storageMismatch) {
          console.info('Push Debug: localStorage token ≠ Firebase getToken — register with update:true')
        }
        await syncTokenToServer(token, userId, storageMismatch)
        if (!aliveRef.current) return

        const pingMs = 30_000
        pingInterval = setInterval(() => {
          void fetch('/api/v2/push', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'ping', token }),
          }).catch(() => {})
        }, pingMs)

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
      }
    }

    void run()

    return () => {
      aliveRef.current = false
      clearMessagingSide()
    }
  }, [user?.id])

  return null
}
