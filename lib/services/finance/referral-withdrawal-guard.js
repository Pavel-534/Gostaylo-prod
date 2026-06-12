/**
 * Stage 114.3 / 131.7 — проверки перед однокнопочным выводом реферальных.
 */
import { supabaseAdmin } from '@/lib/supabase'
import { ReferralFraudGate } from '@/lib/services/marketing/referral-fraud-gate.service.js'

const MAX_REQUESTS_PER_30_DAYS = 5

/**
 * @param {string} userId
 * @returns {Promise<{ ok: boolean, error?: string, blockers?: string[] }>}
 */
export async function assertReferralWithdrawalAllowed(userId) {
  const uid = String(userId || '').trim()
  if (!uid) return { ok: false, error: 'USER_ID_REQUIRED', blockers: ['USER_ID_REQUIRED'] }

  const since = new Date(Date.now() - 30 * 86400000).toISOString()
  const { data: recent, error } = await supabaseAdmin
    .from('user_wallets')
    .select('referral_withdrawal_requested_at')
    .eq('user_id', uid)
    .gte('referral_withdrawal_requested_at', since)
    .limit(10)

  if (error && !/referral_withdrawal_/i.test(String(error.message || ''))) {
    return { ok: false, error: error.message || 'WITHDRAWAL_GUARD_READ_FAILED' }
  }

  const requestCount = (recent || []).filter((r) => r?.referral_withdrawal_requested_at).length
  if (requestCount >= MAX_REQUESTS_PER_30_DAYS) {
    return {
      ok: false,
      error: 'REFERRAL_WITHDRAWAL_RATE_LIMIT',
      blockers: ['REFERRAL_WITHDRAWAL_RATE_LIMIT'],
    }
  }

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
