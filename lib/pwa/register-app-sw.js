/** Register unified app SW (push + asset cache). Stage 171.13 — replaces firebase-messaging-sw.js URL. */

export const APP_SERVICE_WORKER_URL = '/sw.js'

/**
 * Idempotent register — safe for layout, PWA install, and push bootstrap.
 * @returns {Promise<ServiceWorkerRegistration | null>}
 */
export async function registerAppServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    // updateViaCache: 'none' — iOS Safari may otherwise serve a stale SW script from HTTP cache
    // after deploy (standalone cold start keeps old precache + missing new chunks).
    return await navigator.serviceWorker.register(APP_SERVICE_WORKER_URL, {
      scope: '/',
      updateViaCache: 'none',
    })
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[PWA] service worker register failed', error)
    }
    return null
  }
}
