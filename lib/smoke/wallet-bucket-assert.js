/**
 * Stage 151.2 — wallet bucket drift invariant for financial smoke steps.
 */
import { supabaseAdmin } from '@/lib/supabase'

function round2(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

/**
 * Assert internal_credits_thb + withdrawable_balance_thb === balance_thb (±0.01 THB).
 * @param {string} userId
 * @param {{ label?: string }} [options]
 */
export async function assertWalletBucketIntegrity(userId, options = {}) {
  const uid = String(userId || '').trim()
  if (!uid || !supabaseAdmin) return

  const { data, error } = await supabaseAdmin
    .from('user_wallets')
    .select('balance_thb, internal_credits_thb, withdrawable_balance_thb')
    .eq('user_id', uid)
    .maybeSingle()

  if (error) throw new Error(error.message || 'WALLET_BUCKET_ASSERT_READ_FAILED')
  if (!data) return

  const balance = round2(data.balance_thb)
  const internal = round2(data.internal_credits_thb)
  const withdrawable = round2(data.withdrawable_balance_thb)
  const bucketSum = round2(internal + withdrawable)
  const drift = round2(balance - bucketSum)

  if (Math.abs(drift) > 0.01) {
    const label = options.label ? String(options.label) : uid
    throw new Error(
      `AssertionError: Wallet bucket drift detected! user=${label} balance_thb=${balance} internal=${internal} withdrawable=${withdrawable} sum=${bucketSum} drift=${drift}`,
    )
  }
}

export default { assertWalletBucketIntegrity }
