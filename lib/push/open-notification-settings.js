/**
 * Stage 189.36 — Best-effort open OS / browser notification settings.
 * Web has no reliable cross-browser API; Android may honor an intent URL.
 *
 * @returns {'opened' | 'guide'}
 */
export function openNotificationPermissionSettings() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'guide'

  const ua = navigator.userAgent || ''
  const isAndroid = /Android/i.test(ua)

  if (isAndroid) {
    try {
      // General notification settings (more reliable than per-app without package id).
      window.location.href =
        'intent:#Intent;action=android.settings.NOTIFICATION_SETTINGS;end'
      return 'opened'
    } catch {
      /* fall through */
    }
  }

  return 'guide'
}

/**
 * @returns {'android' | 'ios' | 'other'}
 */
export function detectNotificationSettingsPlatform() {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent || ''
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'other'
}
