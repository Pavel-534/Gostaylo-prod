/**
 * Stage 202.0 / 202.2 — Sentry Edge init (loaded from instrumentation.js).
 * Must stay free of Node `crypto` / Telegram notify (webpack traces this graph).
 */

import * as Sentry from '@sentry/nextjs'
import { buildSentryInitOptions } from '@/lib/observability/sentry-init-options.js'

Sentry.init(buildSentryInitOptions('edge'))
