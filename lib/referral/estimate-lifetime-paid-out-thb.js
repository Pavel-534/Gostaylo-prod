/**
 * Stage 192.0 — presentation helper: approximate lifetime referral paid-out (THB).
 * Uses wallet summary fields only (no new API). May undercount if history is truncated.
 *
 * @param {object | null | undefined} walletData
 * @returns {number}
 */
export function estimateLifetimeReferralPaidOutThb(walletData) {
  let sum = 0
  const timeline = walletData?.referralPayoutTimeline
  const history = Array.isArray(timeline?.history) ? timeline.history : []
  for (const row of history) {
    if (String(row?.stage || '').toLowerCase() !== 'paid') continue
    const gross = Number(row?.grossThb)
    if (Number.isFinite(gross) && gross > 0) sum += gross
  }

  if (sum > 0) return Math.round(sum * 100) / 100

  const txs = Array.isArray(walletData?.recentTransactions) ? walletData.recentTransactions : []
  for (const tx of txs) {
    if (String(tx?.operation_type || '').toLowerCase() !== 'debit') continue
    const txType = String(tx?.tx_type || '').toLowerCase()
    const ref = String(tx?.reference_id || '').toLowerCase()
    const isReferralOut =
      txType.includes('referral') ||
      ref.includes('referral_withdraw') ||
      ref.includes('referral_payout')
    if (!isReferralOut) continue
    const amt = Number(tx?.amount_thb)
    if (Number.isFinite(amt) && amt > 0) sum += amt
  }

  return Math.round(sum * 100) / 100
}
