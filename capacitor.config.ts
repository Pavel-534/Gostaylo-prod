import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor shell — Stage 172.0 / feature/capacitor-shell.
 * Remote Next origin (staging/prod). No financial logic in native.
 *
 * Owner: set CAPACITOR_SERVER_URL before `npx cap sync`.
 * Deep links: public/.well-known/* + Associated Domains / App Links.
 * Push: lib/capacitor/push-bridge.js → POST /api/v2/push.
 */
const serverUrl =
  process.env.CAPACITOR_SERVER_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://airento.app'

const config: CapacitorConfig = {
  appId: 'app.airento.shell',
  appName: 'Airento',
  webDir: 'public',
  server: {
    url: serverUrl,
    cleartext: false,
    allowNavigation: [
      'airento.app',
      '*.airento.app',
      'localhost',
      '127.0.0.1',
    ],
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  ios: {
    contentInset: 'automatic',
    scheme: 'Airento',
    limitsNavigationsToAppBoundDomains: true,
  },
  android: {
    allowMixedContent: false,
  },
}

export default config
