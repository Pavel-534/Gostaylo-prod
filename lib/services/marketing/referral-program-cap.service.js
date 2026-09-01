/**
 * Stage 131.0 — monthly referral program cap (guest_booking accruals).
 */
import { supabaseAdmin } from '@/lib/supabase'
import { SystemConfigService } from '@/lib/services/finance/system-config.service.js'
import { resolveFintechPolicyForBooking } from '@/lib/services/finance/fintech-snapshot.service.js'
import { REFERRAL_LEDGER_REFERRAL_TYPE, REFERRAL_STATUSES } from '@/lib/services/marketing/referral-calculation.js'

function round2(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function monthStartUtcIso(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString()
}

function isMissingRpcError(error, rpcName) {
  const msg = String(error?.message || error || '')
  return (
    msg.includes(rpcName) ||
    msg.includes('Could not find the function') ||
    msg.includes('schema cache')
  )
}

let warnedMonthlyGuestSpendRpcMissing = false

/**
 * Legacy Node reduce — cap fallback when referral_program_monthly_guest_spend_thb RPC is missing.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} [monthStartIso]
 */
export async function getMonthlyGuestReferralSpendThbLegacyReduce(
  supabase = supabaseAdmin,
  monthStartIso = monthStartUtcIso(),
) {
  const { data, error } = await supabase
    .from('referral_ledger')
    .select('amount_thb, status, referral_type, created_at')
    .eq('referral_type', REFERRAL_LEDGER_REFERRAL_TYPE.GUEST_BOOKING)
    .gte('created_at', monthStartIso)
    .in('status', [
      REFERRAL_STATUSES.PENDING,
      REFERRAL_STATUSES.EARNED,
      REFERRAL_STATUSES.EARNED_HELD,
    ])

  if (error) {
    if (String(error.message || '').includes('does not exist')) return 0
    throw new Error(error.message || 'REFERRAL_PROGRAM_CAP_READ_FAILED')
  }

  return round2(
    (data || []).reduce((acc, row) => acc + (Number(row?.amount_thb) || 0), 0),
  )
}

/**
 * Sum guest_booking ledger amounts in active statuses for current UTC month (program-wide).
 * @param {string} [monthStartIso]
 * @param {import('@supabase/supabase-js').SupabaseClient} [supabase]
 */
export async function getMonthlyGuestReferralSpendThb(
  monthStartIso = monthStartUtcIso(),
  supabase = supabaseAdmin,
) {
  const { data, error } = await supabase.rpc('referral_program_monthly_guest_spend_thb', {
    p_utc_month_start: monthStartIso,
  })

  if (!error) {
    return round2(data)
  }

  if (isMissingRpcError(error, 'referral_program_monthly_guest_spend_thb')) {
    if (!warnedMonthlyGuestSpendRpcMissing) {
      warnedMonthlyGuestSpendRpcMissing = true
      console.warn(
        '[REFERRAL_CAP] referral_program_monthly_guest_spend_thb RPC missing — legacy Node reduce',
      )
    }
    return getMonthlyGuestReferralSpendThbLegacyReduce(supabase, monthStartIso)
  }

  throw new Error(error.message || 'REFERRAL_PROGRAM_CAP_READ_FAILED')
}

/**
 * Atomic cap reserve via Postgres RPC (FOR UPDATE serialization).
 * Falls back to non-atomic read if RPC is not deployed yet.
 */
async function atomicCapReserve(proposedThb, monthStartIso) {
  try {
    const { data, error } = await supabaseAdmin.rpc('referral_program_cap_reserve', {
      p_proposed_thb: proposedThb,
      p_utc_month_start: monthStartIso,
    })
    if (error) throw error
    if (data && typeof data === 'object') {
      return {
        atomic: true,
        allowed: data.allowed === true,
        spentThb: round2(Number(data.spent) || 0),
        remainingThb: round2(Number(data.remaining) || 0),
        capThb: round2(Number(data.cap) || 0),
        reason: data.reason || null,
      }
    }
  } catch (e) {
    console.warn('[REFERRAL_CAP] RPC fallback:', e?.message || e)
  }
  return null
}

/**
 * @param {{ proposedAccrualThb: number, at?: Date, booking?: object | null }} params
 */
export async function resolveReferralProgramCapGate({ proposedAccrualThb, at = new Date(), booking = null }) {
  const config = booking
    ? await resolveFintechPolicyForBooking(booking)
    : await SystemConfigService.getFintechConfig()
  const capThb = round2(config.referralMonthlyProgramCapThb)

  if (!config.ambassador3ProgramCapEnabled || capThb <= 0) {
    return {
      allowed: true,
      deferred: false,
      capThb,
      spentThb: 0,
      remainingThb: capThb,
      reason: 'CAP_DISABLED',
    }
  }

  const monthStartIso = monthStartUtcIso(at)
  const proposed = round2(Math.max(0, proposedAccrualThb))

  const rpc = await atomicCapReserve(proposed, monthStartIso)
  if (rpc?.atomic) {
    return {
      allowed: rpc.allowed,
      deferred: !rpc.allowed,
      capThb: rpc.capThb,
      spentThb: rpc.spentThb,
      remainingThb: rpc.remainingThb,
      proposedAccrualThb: proposed,
      monthStartIso,
      reason: rpc.allowed ? null : (rpc.reason || 'MONTHLY_PROGRAM_CAP_EXCEEDED'),
    }
  }

  const spentThb = await getMonthlyGuestReferralSpendThb(monthStartIso)
  const remainingThb = round2(Math.max(0, capThb - spentThb))
  const allowed = proposed <= 0 || spentThb + proposed <= capThb + 0.001

  return {
    allowed,
    deferred: !allowed,
    capThb,
    spentThb,
    remainingThb,
    proposedAccrualThb: proposed,
    monthStartIso,
    reason: allowed ? null : 'MONTHLY_PROGRAM_CAP_EXCEEDED',
  }
}

export default { getMonthlyGuestReferralSpendThb, resolveReferralProgramCapGate }
