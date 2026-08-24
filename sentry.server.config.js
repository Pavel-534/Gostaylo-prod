/**
 * Stage 202.0 — Sentry Node server init (loaded from instrumentation.js).
 * Telegram [SENTRY] alerts live here only (Node), not in shared/edge options.
 */

import * as Sentry from '@sentry/nextjs'
import { buildSentryInitOptions } from '@/lib/observability/sentry-init-options.js'
import { maybeNotifySentryTelegram } from '@/lib/observability/sentry-telegram-bridge.js'

const options = buildSentryInitOptions('nodejs')
const scrubBeforeSend = options.beforeSend

options.beforeSend = (event, hint) => {
  const scrubbed = scrubBeforeSend ? scrubBeforeSend(event, hint) : event
  if (scrubbed) {
    void Promise.resolve(maybeNotifySentryTelegram(scrubbed, hint || {})).catch(() => {})
  }
  return scrubbed
}

Sentry.init(options)
