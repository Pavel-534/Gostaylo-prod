import { getCryptoReceiveWallet } from '@/lib/config/crypto-receive-wallet.js'
export { DEFAULT_CHECKOUT_ALLOWED_METHODS as DEFAULT_ALLOWED_METHODS } from '@/lib/config/app-constants'
export { getCryptoReceiveWallet }

/**
 * Checkout UI wallet — soft-fail so CARD/MIR still render if only server wallet env is set
 * (NEXT_PUBLIC missing on client). Server boot still fail-closes via instrumentation.
 */
export const GOSTAYLO_WALLET = (() => {
  try {
    return getCryptoReceiveWallet()
  } catch {
    return String(process.env.NEXT_PUBLIC_CRYPTO_RECEIVE_WALLET || '').trim()
  }
})()
