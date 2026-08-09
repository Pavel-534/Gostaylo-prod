/**
 * Stage 200.76 — SSOT display for crypto checkout modal.
 * Prefer initiate providerPayload (`amount_usdt`, `wallet_address`); live FX only as last resort.
 */

/**
 * @param {{
 *   payment?: { metadata?: Record<string, unknown> } | null
 *   fallbackWallet?: string
 *   totalWithFeeThb?: number
 *   thbPerUsdt?: number | null
 * }} opts
 * @returns {{ amountUsdt: number | null, wallet: string, amountSource: 'intent' | 'live_fx' | 'none' }}
 */
export function resolveCryptoCheckoutDisplay({
  payment = null,
  fallbackWallet = '',
  totalWithFeeThb = 0,
  thbPerUsdt = null,
} = {}) {
  const meta = payment?.metadata && typeof payment.metadata === 'object' ? payment.metadata : {}
  const locked = Number(meta.amount_usdt)
  let amountUsdt = null
  let amountSource = 'none'
  if (Number.isFinite(locked) && locked > 0) {
    amountUsdt = Math.round(locked * 100) / 100
    amountSource = 'intent'
  } else {
    const rate = Number(thbPerUsdt)
    const thb = Number(totalWithFeeThb)
    if (Number.isFinite(rate) && rate > 0 && Number.isFinite(thb) && thb > 0) {
      amountUsdt = Math.ceil((thb / rate) * 100) / 100
      amountSource = 'live_fx'
    }
  }

  const wallet = String(meta.wallet_address || fallbackWallet || '').trim()
  return { amountUsdt, wallet, amountSource }
}
