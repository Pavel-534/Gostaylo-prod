/**
 * Stage 202.0 — Sentry Node server init (loaded from instrumentation.js).
 */

import * as Sentry from '@sentry/nextjs'
import { buildSentryInitOptions } from '@/lib/observability/sentry-init-options.js'

Sentry.init(buildSentryInitOptions('nodejs'))
