/** Register app SW early for PWA installability (Stage 169.4). Same file as FCM push SW. */

const SW_URL = '/firebase-messaging-sw.js'

/**
 * Idempotent register — safe alongside push-client-init.
 * @returns {Promise<ServiceWorkerRegistration | null>}
 */
export async function registerAppServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register(SW_URL, { scope: '/' })
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[PWA] service worker register failed', error)
    }
    return null
  }
}
