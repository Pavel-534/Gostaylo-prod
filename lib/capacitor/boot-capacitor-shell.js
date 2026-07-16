/**
 * Capacitor shell bootstrap (Stage 172.0).
 * Inject Cap plugins from the native entry so Next.js never bundles @capacitor/* until installed.
 *
 * @example
 * // after `npm i @capacitor/core @capacitor/app @capacitor/push-notifications`
 * import { App } from '@capacitor/app'
 * import { PushNotifications } from '@capacitor/push-notifications'
 * import { Capacitor } from '@capacitor/core'
 * import { bootCapacitorShell } from '@/lib/capacitor/boot-capacitor-shell.js'
 * await bootCapacitorShell({
 *   Capacitor, App, PushNotifications,
 *   navigate: (path) => { window.location.assign(path) },
 * })
 */

import { deepLinkPathFromPushData, resolveCapacitorDeepLinkPath } from './deep-links.js'
import { registerCapacitorPushToken } from './push-bridge.js'

/**
 * @param {{
 *   Capacitor: { isNativePlatform: () => boolean, getPlatform: () => string },
 *   App: { addListener: Function, getLaunchUrl: () => Promise<{ url?: string } | null> },
 *   PushNotifications: { requestPermissions: Function, register: Function, addListener: Function },
 *   navigate: (path: string) => void,
 * }} opts
 */
export async function bootCapacitorShell({ Capacitor, App, PushNotifications, navigate }) {
  if (typeof window === 'undefined') return { ok: false, reason: 'ssr' }
  if (!Capacitor?.isNativePlatform?.()) return { ok: false, reason: 'not_native' }
  if (typeof navigate !== 'function') return { ok: false, reason: 'navigate_required' }

  const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android'

  App.addListener('appUrlOpen', (event) => {
    const path = resolveCapacitorDeepLinkPath(event?.url)
    if (path) navigate(path)
  })

  const launch = await App.getLaunchUrl().catch(() => null)
  if (launch?.url) {
    const path = resolveCapacitorDeepLinkPath(launch.url)
    if (path) navigate(path)
  }

  await PushNotifications.requestPermissions()
  await PushNotifications.register()

  PushNotifications.addListener('registration', (token) => {
    const value = token?.value
    if (!value) return
    void registerCapacitorPushToken({ token: value, platform })
  })

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const data = action?.notification?.data || {}
    const path = deepLinkPathFromPushData(data)
    if (path) navigate(path)
  })

  return { ok: true, platform }
}
