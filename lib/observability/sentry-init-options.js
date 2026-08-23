/**
 * Stage 202.0 — shared Sentry.init options (no Replay / Profiling).
 */

import { resolveSentryDsn } from '@/lib/observability/sentry-dsn.js'
import {
  isSensitiveSentryTransaction,
  scrubSentryEvent,
} from '@/lib/observability/sentry-scrub.js'

/**
 * @param {'client' | 'nodejs' | 'edge'} runtime
 */
export function buildSentryInitOptions(runtime) {
  const dsn = resolveSentryDsn()
  const enabled = Boolean(dsn)

  return {
    dsn: dsn || undefined,
    enabled,
    environment:
      process.env.SENTRY_ENVIRONMENT ||
      process.env.VERCEL_ENV ||
      process.env.NODE_ENV ||
      'development',
    release:
      process.env.SENTRY_RELEASE ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.NEXT_PUBLIC_APP_RELEASE_VERSION ||
      undefined,
    sampleRate: 1.0,
    tracesSampleRate: enabled ? 0.05 : 0,
    // Explicitly no Session Replay / Profiling integrations.
    integrations: (defaults) =>
      (defaults || []).filter((integration) => {
        const name = String(integration?.name || '')
        return !/Replay|Profiling|BrowserProfiling/i.test(name)
      }),
    beforeSend(event, hint) {
      if (!event) return null
      if (isSensitiveSentryTransaction(event) && !event.exception) {
        // Drop pure performance noise on money paths; still allow hard exceptions.
        return null
      }
      const scrubbed = scrubSentryEvent(event)
      if (runtime === 'nodejs') {
        // Dynamic import keeps edge/client bundles free of TG + crypto deps.
        void import('@/lib/observability/sentry-telegram-bridge.js')
          .then((m) => m.maybeNotifySentryTelegram(scrubbed, hint || {}))
          .catch(() => {})
      }
      return scrubbed
    },
  }
}
