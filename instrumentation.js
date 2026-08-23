/**
 * Next.js instrumentation — runs once on Node/Edge server start.
 * Stage 200.42 / 200.75 — payment fail-closed guards.
 * Stage 202.0 — Sentry server/edge register + onRequestError.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config.js')
  } else if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config.js')
  }

  if (process.env.NEXT_RUNTIME === 'edge') return

  const allowClientConfirm = String(process.env.PAYMENT_ALLOW_CLIENT_CONFIRM || '').trim() === '1'
  const isProduction =
    process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'

  if (isProduction && allowClientConfirm) {
    throw new Error(
      'CRITICAL: PAYMENT_ALLOW_CLIENT_CONFIRM is enabled in production. Unset the env var and redeploy.',
    )
  }

  if (isProduction) {
    const { assertCryptoReceiveWalletConfigured } = await import(
      '@/lib/config/crypto-receive-wallet.js'
    )
    assertCryptoReceiveWalletConfigured()
  }
}

export async function onRequestError(err, request, context) {
  const Sentry = await import('@sentry/nextjs')
  if (typeof Sentry.captureRequestError === 'function') {
    Sentry.captureRequestError(err, request, context)
    return
  }
  if (typeof Sentry.captureException === 'function') {
    Sentry.captureException(err)
  }
}
