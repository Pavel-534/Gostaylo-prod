/**
 * Capacitor shell scaffold (Stage 172 / 189).
 * No import from `@capacitor/cli` — that package is Cap-branch only; Next/Vercel
 * typecheck must not require it for production builds.
 *
 * Owner: set CAPACITOR_SERVER_URL before `npx cap sync`.
 * Deep links: public/.well-known/* + Associated Domains / App Links.
 * Push: lib/capacitor/push-bridge.js → POST /api/v2/push.
 */

const serverUrl =
  process.env.CAPACITOR_SERVER_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://airento.app'

const config = {
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
