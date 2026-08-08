/**
 * Stage 200.75 — USDT (TRC-20) receive wallet SSOT.
 * Fail-closed in production: no hardcoded address when env is missing.
 * Kept outside `app-constants.js` so BOOKING_STATUS / catalog imports never require wallet env.
 *
 * Do not export an eager `GOSTAYLO_WALLET` const from this file — `payment-intent.service`
 * imports the getter for CARD/MIR too; throw only when resolve is called (CRYPTO) or at boot.
 */

/** Dev-only legacy address — never used when NODE_ENV/VERCEL_ENV is production. */
const DEV_ONLY_FALLBACK_WALLET = 'TXyfMKVxUNFkC8Q77GnbAqgnWFUWVaKwZ5'

export class CryptoReceiveWalletMissingError extends Error {
  constructor() {
    super(
      'CRITICAL: NEXT_PUBLIC_CRYPTO_RECEIVE_WALLET or CRYPTO_RECEIVE_WALLET is required in production. Set the platform USDT receive address and redeploy.',
    )
    this.name = 'CryptoReceiveWalletMissingError'
  }
}

function isProductionRuntime() {
  // `next build` sets NODE_ENV=production — do not throw during compile/SSG collection.
  if (String(process.env.NEXT_PHASE || '').trim() === 'phase-production-build') return false
  return (
    String(process.env.NODE_ENV || '').trim() === 'production' ||
    String(process.env.VERCEL_ENV || '').trim() === 'production'
  )
}

function readWalletFromEnv() {
  return String(
    process.env.NEXT_PUBLIC_CRYPTO_RECEIVE_WALLET || process.env.CRYPTO_RECEIVE_WALLET || '',
  ).trim()
}

/**
 * Resolve platform crypto receive address.
 * @returns {string}
 * @throws {CryptoReceiveWalletMissingError} in production when env is unset
 */
export function getCryptoReceiveWallet() {
  const fromEnv = readWalletFromEnv()
  if (fromEnv) return fromEnv
  if (isProductionRuntime()) {
    throw new CryptoReceiveWalletMissingError()
  }
  return DEV_ONLY_FALLBACK_WALLET
}

/**
 * Boot / instrumentation guard — throws in production if wallet env is missing.
 */
export function assertCryptoReceiveWalletConfigured() {
  if (!isProductionRuntime()) return
  if (readWalletFromEnv()) return
  throw new CryptoReceiveWalletMissingError()
}
