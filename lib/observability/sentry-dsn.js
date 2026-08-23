/**
 * Stage 202.0 — resolve Sentry DSN (server prefers SENTRY_DSN).
 * Empty → SDK must stay no-op (CI / Preview safe).
 */

export function resolveSentryDsn() {
  const server = String(process.env.SENTRY_DSN || '').trim()
  if (server) return server
  return String(process.env.NEXT_PUBLIC_SENTRY_DSN || '').trim()
}

export function isSentryConfigured() {
  return Boolean(resolveSentryDsn())
}
