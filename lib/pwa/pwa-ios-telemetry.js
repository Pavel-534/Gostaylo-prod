/**
 * Stage 189.0 / 189.1 — client-side PWA / iOS measurement hooks for Phuket smoke + future RUM.
 * Dev/staging: console group. Never touches financial SSOT.
 */

import { isIosSafari, isStandaloneDisplayMode } from '@/lib/pwa/pwa-platform.js'
import { getNetworkQualitySnapshot } from '@/lib/media/network-quality.js'
import { SW_MESSAGE_GET_STATUS } from '@/lib/pwa/service-worker-messages.js'

const STORAGE_KEY = 'airento_pwa_perf_v1'
const RESUME_STORAGE_KEY = 'airento_pwa_resume_v1'
const STAGE_TAG = '189.1'

/**
 * @returns {Record<string, unknown>}
 */
export function collectPwaRuntimeSnapshot() {
  const nav = typeof navigator !== 'undefined' ? navigator : null
  const sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : null
  return {
    ts: new Date().toISOString(),
    path: typeof location !== 'undefined' ? location.pathname : null,
    standalone: isStandaloneDisplayMode(),
    ios: isIosSafari(),
    network: getNetworkQualitySnapshot(),
    sw: {
      supported: Boolean(sw),
      controller: Boolean(sw?.controller),
    },
    memory:
      nav && 'deviceMemory' in nav
        ? { deviceMemory: /** @type {{ deviceMemory?: number }} */ (nav).deviceMemory }
        : null,
    connectionEtaMs: null,
  }
}

/**
 * Mark navigation timing for cold start analysis (standalone Home Screen).
 * @returns {Record<string, number | null> | null}
 */
export function readNavigationTimingMarks() {
  if (typeof performance === 'undefined') return null
  try {
    const nav = performance.getEntriesByType?.('navigation')?.[0]
    if (!nav) return null
    return {
      ttfbMs: Math.round(nav.responseStart || 0),
      domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd || 0),
      loadEventMs: Math.round(nav.loadEventEnd || 0),
      transferSize: Number(nav.transferSize) || null,
    }
  } catch {
    return null
  }
}

/**
 * Paint timing (FCP) when available — useful for white-flash checks on iOS standalone.
 * @returns {{ fcpMs: number | null } | null}
 */
export function readPaintTimingMarks() {
  if (typeof performance === 'undefined') return null
  try {
    const paints = performance.getEntriesByType?.('paint') || []
    const fcp = paints.find((e) => e.name === 'first-contentful-paint')
    return {
      fcpMs: fcp ? Math.round(fcp.startTime) : null,
    }
  } catch {
    return null
  }
}

/**
 * Persist last snapshot (local only) for owner Web Inspector copy-paste.
 * @param {Record<string, unknown>} snapshot
 */
export function persistPwaPerfSnapshot(snapshot) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    /* private mode */
  }
}

/**
 * @param {Record<string, unknown>} snapshot
 */
function persistResumeSnapshot(snapshot) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    /* private mode */
  }
}

/**
 * Ask controlling SW for cache name (owner smoke / debugging).
 * @returns {Promise<{ cacheName?: string, precacheCount?: number } | null>}
 */
export function queryServiceWorkerStatus() {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker?.controller) {
    return Promise.resolve(null)
  }
  return new Promise((resolve) => {
    const channel = new MessageChannel()
    const timer = setTimeout(() => {
      resolve(null)
    }, 1500)
    channel.port1.onmessage = (event) => {
      clearTimeout(timer)
      resolve(event.data?.type === 'STATUS' ? event.data : null)
    }
    try {
      navigator.serviceWorker.controller.postMessage(
        { type: SW_MESSAGE_GET_STATUS },
        [channel.port2],
      )
    } catch {
      clearTimeout(timer)
      resolve(null)
    }
  })
}

/**
 * Mark `html[data-pwa-standalone]` for CSS / diagnostics (safe-area audits).
 */
export function applyStandaloneDocumentAttrs() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (isStandaloneDisplayMode()) {
    root.setAttribute('data-pwa-standalone', '1')
  } else {
    root.removeAttribute('data-pwa-standalone')
  }
  if (isIosSafari()) {
    root.setAttribute('data-pwa-ios', '1')
  }
}

/**
 * One-shot cold-start log for standalone / iOS. Safe to call from useEffect.
 */
export function reportPwaColdStartOnce() {
  if (typeof window === 'undefined') return
  const w = /** @type {Window & { __airentoPwaColdLogged?: boolean }} */ (window)
  if (w.__airentoPwaColdLogged) return
  w.__airentoPwaColdLogged = true

  applyStandaloneDocumentAttrs()

  const shouldLog =
    process.env.NODE_ENV !== 'production' || isStandaloneDisplayMode() || isIosSafari()

  void (async () => {
    const swStatus = await queryServiceWorkerStatus()
    const snapshot = {
      ...collectPwaRuntimeSnapshot(),
      navigation: readNavigationTimingMarks(),
      paint: readPaintTimingMarks(),
      swStatus,
      stage: STAGE_TAG,
    }
    persistPwaPerfSnapshot(snapshot)
    if (shouldLog) {
      // eslint-disable-next-line no-console
      console.info('[Airento PWA 189]', snapshot)
    }
  })()
}

/**
 * Stage 189.1 — log resume after background (owner checks refetch storm vs quiet resume).
 */
export function reportPwaResumeFromBackground() {
  if (typeof window === 'undefined') return
  const snapshot = {
    ...collectPwaRuntimeSnapshot(),
    event: 'resume',
    stage: STAGE_TAG,
    hiddenMs: null,
  }
  persistResumeSnapshot(snapshot)
  if (process.env.NODE_ENV !== 'production' || isStandaloneDisplayMode()) {
    // eslint-disable-next-line no-console
    console.info('[Airento PWA 189]', snapshot)
  }
}

export function getStoredPwaPerfSnapshot() {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
