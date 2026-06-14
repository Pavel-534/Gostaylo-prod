/**
 * Stage 137 — referral queue + relation integrity snapshot for /admin/health.
 * Stage 137.1 — cycle detection via Postgres RPC (scalable EXISTS scan).
 */
import { supabaseAdmin } from '@/lib/supabase'

function round2(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

export async function loadReferralSystemHealth() {
  const out = {
    activeWithdrawalLocks: 0,
    frozenWithdrawalThb: 0,
    relationCycleCount: 0,
    relationCycleSample: [],
    error: null,
  }

  if (!supabaseAdmin) {
    out.error = 'Server database client unavailable'
    return out
  }

  try {
    const { data: lockRows, error: lockErr, count: lockCount } = await supabaseAdmin
      .from('user_wallets')
      .select('referral_withdrawal_amount_thb, withdrawable_balance_thb', { count: 'exact' })
      .eq('referral_withdrawal_status', 'withdrawable_referral')

    if (lockErr) {
      out.error = lockErr.message
      return out
    }

    out.activeWithdrawalLocks = Number(lockCount || 0)
    out.frozenWithdrawalThb = round2(
      (lockRows || []).reduce(
        (acc, row) =>
          acc +
          Number(row?.referral_withdrawal_amount_thb ?? row?.withdrawable_balance_thb ?? 0),
        0,
      ),
    )

    const { data: cyclePayload, error: cycleErr } = await supabaseAdmin.rpc(
      'stage137_detect_referral_cycles_rpc',
    )

    if (cycleErr) {
      out.error = cycleErr.message
      return out
    }

    const cycleData =
      cyclePayload && typeof cyclePayload === 'object' && !Array.isArray(cyclePayload)
        ? cyclePayload
        : Array.isArray(cyclePayload)
          ? cyclePayload[0]
          : null

    out.relationCycleCount = Number(cycleData?.cycleCount ?? 0)
    const sample = cycleData?.cycleSample
    out.relationCycleSample = Array.isArray(sample)
      ? sample.slice(0, 5).map((row) => ({
          id: String(row?.id || ''),
          refereeId: String(row?.refereeId || row?.referee_id || ''),
        }))
      : []
  } catch (e) {
    out.error = e?.message || String(e)
  }

  return out
}

export default { loadReferralSystemHealth }
