/**
 * Next.js instrumentation — runs once on Node server start (Stage 200.42 C3).
 * Fail-closed: never boot production with PAYMENT_ALLOW_CLIENT_CONFIRM=1.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'edge') return

  const allowClientConfirm = String(process.env.PAYMENT_ALLOW_CLIENT_CONFIRM || '').trim() === '1'
  const isProduction =
    process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'

  if (isProduction && allowClientConfirm) {
    throw new Error(
      'CRITICAL: PAYMENT_ALLOW_CLIENT_CONFIRM is enabled in production. Unset the env var and redeploy.',
    )
  }
}
