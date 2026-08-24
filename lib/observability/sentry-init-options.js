/**
 * Stage 202.0 — shared Sentry.init options (no Replay / Profiling).
 * Edge/client-safe: do NOT import Telegram / Node crypto from this module
 * (webpack would pull `crypto` into sentry.edge.config and fail the build).
 * Node TG bridge is wired only in sentry.server.config.js.
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
  void runtime

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
    beforeSend(event) {
      if (!event) return null
      if (isSensitiveSentryTransaction(event) && !event.exception) {
        return null
      }
      return scrubSentryEvent(event)
    },
  }
}
