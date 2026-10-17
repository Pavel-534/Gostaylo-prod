/**
 * Browser cache warmup for PDP lightbox mains (Stage 202.53).
 * Idle / idle-ish schedule so hero LCP is not starved.
 */
import { getNetworkQualitySnapshot } from '@/lib/media/network-quality'

const warmedUrls = new Set()
const MAX_WARM_DEFAULT = 6
const MAX_WARM_CONSTRAINED = 2

/**
 * @param {string | null | undefined} url
 * @returns {boolean}
 */
function canWarmUrl(url) {
  if (!url || typeof url !== 'string') return false
  if (url === '/placeholder.svg') return false
  if (warmedUrls.has(url)) return false
  return true
}

/**
 * @param {string} url
 */
function warmOne(url) {
  if (!canWarmUrl(url)) return
  warmedUrls.add(url)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
  } catch {
    warmedUrls.delete(url)
  }
}

/**
 * @param {string[]} urls
 * @param {{ max?: number, immediate?: boolean }} [opts]
 */
export function warmupPdpLightboxUrls(urls, opts = {}) {
  if (typeof window === 'undefined') return
  if (!Array.isArray(urls) || urls.length === 0) return

  const constrained = getNetworkQualitySnapshot().constrained === true
  const max =
    Number.isFinite(opts.max) && opts.max > 0
      ? Math.floor(opts.max)
      : constrained
        ? MAX_WARM_CONSTRAINED
        : MAX_WARM_DEFAULT

  const queue = urls.filter(canWarmUrl).slice(0, max)
  if (!queue.length) return

  const run = () => {
    for (const url of queue) warmOne(url)
  }

  if (opts.immediate === true) {
    run()
    return
  }

  // After first paint / LCP — soft background warm.
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: 1800 })
  } else {
    window.setTimeout(run, 400)
  }
}

/**
 * Warm current + neighbours when lightbox is already open (swipe ahead).
 * @param {string[]} urls
 * @param {number} currentIndex
 */
export function warmupPdpLightboxNeighbors(urls, currentIndex) {
  if (typeof window === 'undefined') return
  if (!Array.isArray(urls) || urls.length === 0) return
  const i = Number(currentIndex)
  if (!Number.isFinite(i)) return
  const n = urls.length
  const idx = ((Math.floor(i) % n) + n) % n
  const neighbors = [urls[idx], urls[(idx + 1) % n], urls[(idx - 1 + n) % n]].filter(Boolean)
  warmupPdpLightboxUrls(neighbors, { max: 3, immediate: true })
}
