/**
 * Stage 132.3 — SSOT: referral ambassador withdrawal row on `payouts`.
 */

/**
 * @param {{ payout_rail?: string, payoutRail?: string, metadata?: { payout_type?: string } } | null | undefined} row
 * @returns {boolean}
 */
export function isReferralWithdrawalPayout(row) {
  if (!row) return false
  const rail = String(row.payout_rail || row.payoutRail || '').toUpperCase()
  const type = String(row.metadata?.payout_type || '').toLowerCase()
  return rail === 'REFERRAL_RUB_CARD' || type === 'referral_withdrawal'
}

/** Stage 134 — host batch settle must ignore open ambassador referral withdrawals on shared `payouts`. */
export function isOpenPartnerHostPayoutRow(row) {
  return !isReferralWithdrawalPayout(row)
}

export default { isReferralWithdrawalPayout, isOpenPartnerHostPayoutRow }
