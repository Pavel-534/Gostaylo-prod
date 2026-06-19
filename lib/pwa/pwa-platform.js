/**
 * @returns {boolean}
 */
export function isStandaloneDisplayMode() {
  if (typeof window === 'undefined') return false
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true
    if (window.matchMedia('(display-mode: fullscreen)').matches) return true
  } catch {
    /* ignore */
  }
  // @ts-expect-error legacy iOS
  if (typeof navigator !== 'undefined' && navigator.standalone === true) return true
  return false
}

/**
 * @returns {boolean}
 */
export function isIosSafari() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (!isIos) return false
  // Exclude Chrome/Firefox/Edge on iOS — still <may> support add to home but UX differs; still show iOS instructions
  return true
}

/**
 * @returns {'android' | 'ios' | 'unsupported'}
 */
export function detectPwaInstallPlatform() {
  if (typeof navigator === 'undefined') return 'unsupported'
  if (isIosSafari()) return 'ios'
  const ua = navigator.userAgent || ''
  if (/Android/i.test(ua)) return 'android'
  return 'unsupported'
}

/**
 * @returns {boolean}
 */
export function canShowPwaInstallUi() {
  const platform = detectPwaInstallPlatform()
  return platform === 'android' || platform === 'ios'
}
