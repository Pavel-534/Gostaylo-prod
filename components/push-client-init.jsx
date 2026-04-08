'use client'

/**
 * Инициализация Web Push (FCM) в браузере:
 * - регистрирует Service Worker
 * - запрашивает permission
 * - получает FCM token и регистрирует его на сервере
 * - прокидывает push-события в window для мгновенного обновления badge/звука
 */

import { useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { getFirebaseAppSafe, getFirebaseVapidKey } from '@/lib/firebase-web'

export function PushClientInit() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user?.id) return
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return

    let unsubscribeOnMessage = null
    let swMessageHandler = null
    let cancelled = false

    const run = async () => {
      try {
        const app = getFirebaseAppSafe()
        const vapidKey = getFirebaseVapidKey()
        if (!app || !vapidKey) return

        const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js')

        if (Notification.permission === 'default') {
          await Notification.requestPermission()
        }
        if (Notification.permission !== 'granted') return

        const { isSupported, getMessaging, getToken, onMessage } = await import('firebase/messaging')
        if (!(await isSupported())) return

        const messaging = getMessaging(app)
        const token = await getToken(messaging, {
          vapidKey,
          serviceWorkerRegistration: reg,
        })
        if (cancelled || !token) return

        const prev = localStorage.getItem('gostaylo_fcm_token') || ''
        if (prev !== token) {
          const res = await fetch('/api/v2/push', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'register', token }),
          })
          if (res.ok) {
            localStorage.setItem('gostaylo_fcm_token', token)
          }
        }

        // Foreground data message
        unsubscribeOnMessage = onMessage(messaging, (payload) => {
          const data = payload?.data || {}
          window.dispatchEvent(new CustomEvent('gostaylo:push-message', { detail: data }))
        })

        // Background SW -> page message
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
      cancelled = true
      if (typeof unsubscribeOnMessage === 'function') unsubscribeOnMessage()
      if (swMessageHandler) navigator.serviceWorker.removeEventListener('message', swMessageHandler)
    }
  }, [user?.id])

  return null
}
