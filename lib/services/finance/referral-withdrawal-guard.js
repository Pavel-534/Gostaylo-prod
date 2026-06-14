/**
 * Stage 114.3 / 131.7 / 136 — fraud gate before referral withdrawal (rate limit → RPC SSOT).
 */
import { ReferralFraudGate } from '@/lib/services/marketing/referral-fraud-gate.service.js'

/**
 * @param {string} userId
 * @returns {Promise<{ ok: boolean, error?: string, blockers?: string[] }>}
 */
export async function assertReferralWithdrawalAllowed(userId) {
  const uid = String(userId || '').trim()
  if (!uid) return { ok: false, error: 'USER_ID_REQUIRED', blockers: ['USER_ID_REQUIRED'] }

  const fraudGate = await ReferralFraudGate.evaluateWithdrawal(uid)
  if (!fraudGate.ok) {
    return {
      ok: false,
      error: fraudGate.error || 'REFERRAL_WITHDRAWAL_BLOCKED',
      blockers: fraudGate.blockers || ['REFERRAL_WITHDRAWAL_BLOCKED'],
    }
  }

  return { ok: true }
}
