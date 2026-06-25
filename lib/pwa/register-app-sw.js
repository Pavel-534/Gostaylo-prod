/** Register unified app SW (push + asset cache). Stage 171.13 — replaces firebase-messaging-sw.js URL. */

export const APP_SERVICE_WORKER_URL = '/sw.js'

/**
 * Idempotent register — safe for layout, PWA install, and push bootstrap.
 * @returns {Promise<ServiceWorkerRegistration | null>}
 */
export async function registerAppServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register(APP_SERVICE_WORKER_URL, { scope: '/' })
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[PWA] service worker register failed', error)
    }
    return null
  }
}
