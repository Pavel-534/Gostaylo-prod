/**
 * Stage 202.0 — Sentry browser init (Next.js instrumentation-client).
 * No Session Replay / Profiling. No Telegram from client.
 */

import * as Sentry from '@sentry/nextjs'
import { buildSentryInitOptions } from '@/lib/observability/sentry-init-options.js'

Sentry.init(buildSentryInitOptions('client'))

/** Next/Sentry navigation instrumentation (no-op if SDK build omits the helper). */
export const onRouterTransitionStart =
  typeof Sentry.captureRouterTransitionStart === 'function'
    ? Sentry.captureRouterTransitionStart
    : () => {}
