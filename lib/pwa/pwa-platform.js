/**
 * Stage 200.81 — PWA install platform buckets (Android native/manual, iOS Safari/other).
 */

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
export function isIosDevice() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/iPad|iPhone|iPod/.test(ua)) return true
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

/**
 * True Safari on iOS (not Chrome/Firefox/Edge/Yandex on iOS).
 * @returns {boolean}
 */
export function isIosSafariBrowser() {
  if (!isIosDevice()) return false
  const ua = navigator.userAgent || ''
  if (/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|Yandex/i.test(ua)) return false
  return /Safari/i.test(ua)
}

/**
 * @returns {'android' | 'ios' | 'unsupported'}
 */
export function detectPwaInstallPlatform() {
  if (typeof navigator === 'undefined') return 'unsupported'
  if (isIosDevice()) return 'ios'
  const ua = navigator.userAgent || ''
  if (/Android/i.test(ua)) return 'android'
  return 'unsupported'
}

/**
 * Static family before native prompt is known.
 * @returns {'ios_safari' | 'ios_other' | 'android' | 'unsupported'}
 */
export function detectPwaInstallFamily() {
  const platform = detectPwaInstallPlatform()
  if (platform === 'ios') return isIosSafariBrowser() ? 'ios_safari' : 'ios_other'
  if (platform === 'android') return 'android'
  return 'unsupported'
}

/**
 * Runtime install UX bucket (pass canNativeInstall from beforeinstallprompt).
 * @param {boolean} [canNativeInstall]
 * @returns {'android_native' | 'android_manual' | 'ios_safari' | 'ios_other' | 'unsupported'}
 */
export function resolvePwaInstallBucket(canNativeInstall = false) {
  const family = detectPwaInstallFamily()
  if (family === 'android') return canNativeInstall ? 'android_native' : 'android_manual'
  if (family === 'ios_safari' || family === 'ios_other') return family
  return 'unsupported'
}

/**
 * @returns {boolean}
 */
export function canShowPwaInstallUi() {
  const platform = detectPwaInstallPlatform()
  return platform === 'android' || platform === 'ios'
}

/** @deprecated use isIosDevice / isIosSafariBrowser */
export function isIosSafari() {
  return isIosDevice()
}
