/**
 * Stage 100.8 — shared shape for GET /preview and POST /preview-batch.
 */

/**
 * @param {Awaited<ReturnType<import('./partner-payout-fx.js').computePayoutFeeThb>>} math
 * @param {Record<string, unknown>} [extras]
 */
export function mapPartnerPayoutPreviewData(math, extras = {}) {
  if (!math) return { error: 'PREVIEW_FAILED', ...extras }
  if (math.error) {
    return {
      error: math.error,
      baseAmountThb: math.baseAmountThb ?? 0,
      feeAmountThb: math.feeAmount ?? 0,
      finalAmountThb: math.finalAmountThb ?? 0,
      ...extras,
    }
  }
  return {
    baseAmountThb: math.baseAmountThb,
    feeAmountThb: math.feeAmount,
    finalAmountThb: math.finalAmountThb,
    amountInPayoutCurrency: math.amountInPayoutCurrency,
    payoutCurrency: math.payoutCurrency,
    fx: math.fx,
    ...extras,
  }
}

/** @param {number} amountThb */
export function payoutPreviewAmountKey(amountThb) {
  const n = Number(amountThb)
  if (!Number.isFinite(n) || n <= 0) return '0'
  return String(Math.round(n * 100) / 100)
}
