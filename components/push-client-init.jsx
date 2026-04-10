'use client'

/**
 * Инициализация Web Push (FCM) в браузере:
 * - регистрирует Service Worker
 * - запрашивает permission
 * - получает FCM token и регистрирует его на сервере
 * - прокидывает push-события в window для мгновенного обновления badge/звука
 *
 * Важно: async-run + setInterval — интервал и подписки задаются только если эффект
 * ещё не снят; cleanup всегда чистит ping и слушатели (иначе утечки и лавина fetch).
 */

import { useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { getFirebaseAppSafe, getFirebaseVapidKey } from '@/lib/firebase-web'

export function PushClientInit() {
  const { user } = useAuth()
  const aliveRef = useRef(true)

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

    const cleanupListeners = () => {
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

    const run = async () => {
      try {
        const app = getFirebaseAppSafe()
        const vapidKey = getFirebaseVapidKey()
        if (!app || !vapidKey) return

        const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
        if (!aliveRef.current) return

        if (Notification.permission === 'default') {
          await Notification.requestPermission()
        }
        if (!aliveRef.current) return
        if (Notification.permission !== 'granted') return

        const { isSupported, getMessaging, getToken, onMessage } = await import('firebase/messaging')
        if (!(await isSupported())) return
        if (!aliveRef.current) return

        const messaging = getMessaging(app)
        const token = await getToken(messaging, {
          vapidKey,
          serviceWorkerRegistration: reg,
        })
        if (!aliveRef.current || !token) return

        const res = await fetch('/api/v2/push', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'register', token, deviceInfo }),
        })
        if (res.ok) {
          localStorage.setItem('gostaylo_fcm_token', token)
        }
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
      } catch {
        // silent
      }
    }

    void run()

    return () => {
      aliveRef.current = false
      cleanupListeners()
    }
  }, [user?.id])

  return null
}
