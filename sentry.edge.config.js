/**
 * Stage 202.0 — Sentry Edge init (loaded from instrumentation.js).
 * No Telegram bridge (nodejs-only).
 */

import * as Sentry from '@sentry/nextjs'
import { buildSentryInitOptions } from '@/lib/observability/sentry-init-options.js'

Sentry.init(buildSentryInitOptions('edge'))
