/**
 * Stage 189.38 — Web Push platform gates (iOS PWA standalone, device_info helpers).
 */

import { isIosDevice, isStandaloneDisplayMode } from '@/lib/pwa/pwa-platform.js'

/** iOS Web Push works only when installed to Home Screen (standalone). */
export const IOS_WEB_PUSH_REQUIRES_STANDALONE = true

/**
 * @returns {boolean}
 */
export function hasWebPushApiSupport() {
  if (typeof window === 'undefined') return false
  return 'serviceWorker' in navigator && 'Notification' in window
}

/**
 * Client-side: can this browser/device register for web push right now?
 * @returns {boolean}
 */
export function canRegisterWebPushOnThisDevice() {
  if (!hasWebPushApiSupport()) return false
  if (isIosDevice() && IOS_WEB_PUSH_REQUIRES_STANDALONE && !isStandaloneDisplayMode()) {
    return false
  }
  return true
}

/**
 * @returns {'ios_browser_tab' | 'unsupported' | null}
 */
export function getWebPushUnavailableReason() {
  if (!hasWebPushApiSupport()) return 'unsupported'
  if (isIosDevice() && IOS_WEB_PUSH_REQUIRES_STANDALONE && !isStandaloneDisplayMode()) {
    return 'ios_browser_tab'
  }
  return null
}

/**
 * Server-side: infer iOS web token from stored device_info (hygiene cron).
 * @param {object|null|undefined} deviceInfo
 * @returns {boolean}
 */
export function isIosWebPushTokenFromDeviceInfo(deviceInfo) {
  if (!deviceInfo || typeof deviceInfo !== 'object') return false
  const ua = String(deviceInfo.userAgent || deviceInfo.user_agent || '')
  const platform = String(deviceInfo.platform || '')
  if (/iPad|iPhone|iPod/i.test(ua)) return true
  if (/iPad|iPhone|iPod/i.test(platform)) return true
  if (platform === 'MacIntel' && /Mobile/i.test(ua)) return true
  return false
}
