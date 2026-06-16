/**
 * Stage 151.1 — SSOT wrapper for referral_distribute_bonus_atomic RPC.
 */
import { supabaseAdmin } from '@/lib/supabase'
import WalletService from '@/lib/services/finance/wallet.service.js'
import { beneficiaryIdForLedgerRow } from '@/lib/services/marketing/referral-hold.service.js'

const REFERRER_BONUS = 'bonus'

function round2(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function resolveTxTypeForLedgerRow(row) {
  return String(row?.type || '').toLowerCase() === REFERRER_BONUS ? 'referral_bonus' : 'referral_cashback'
}

const RETENTION_SPLIT_TX_TYPES = new Set([
  'referral_bonus',
  'referral_bonus_withdrawable',
  'referral_bonus_internal',
  'referral_bonus_host_activation',
  'referral_bonus_supply',
])

/**
 * @param {object} row referral_ledger row
 * @param {string} beneficiaryId
 */
async function resolvePayoutToInternalRatio(row, beneficiaryId) {
  const txType = resolveTxTypeForLedgerRow(row)
  if (!RETENTION_SPLIT_TX_TYPES.has(txType)) return 0
  const retention = await WalletService.getRetentionPolicy(beneficiaryId)
  return round2(retention?.payoutToInternalRatio ?? 0)
}

/**
 * @param {{
 *   row: object,
 *   bookingId: string,
 *   earnedAt?: string,
 *   unlockAt?: string|null,
 *   metadataPatch?: object|null,
 *   creditOnly?: boolean,
 * }} params
 */
export async function distributeReferralLedgerCreditAtomic(params = {}) {
  const row = params.row || {}
  const ledgerId = String(row.id || '').trim()
  const bookingId = String(params.bookingId || row.booking_id || '').trim()
  const beneficiaryId = beneficiaryIdForLedgerRow(row)
  const amountThb = round2(row.amount_thb)
  const creditOnly = params.creditOnly === true

  if (!ledgerId || !beneficiaryId || amountThb <= 0) {
    return {
      success: false,
      error: 'INVALID_ATOMIC_PARAMS',
      ledgerId,
    }
  }

  const txType = resolveTxTypeForLedgerRow(row)
  const payoutToInternalRatio = await resolvePayoutToInternalRatio(row, beneficiaryId)
  const earnedAt =
    params.earnedAt != null && String(params.earnedAt).trim() !== ''
      ? String(params.earnedAt)
      : new Date().toISOString()
  const metadataPatch =
    params.metadataPatch && typeof params.metadataPatch === 'object' ? params.metadataPatch : {}
  const prevMeta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  const mergedPatch = creditOnly ? {} : { ...prevMeta, ...metadataPatch }

  try {
    const { data, error } = await supabaseAdmin.rpc('referral_distribute_bonus_atomic', {
      p_ledger_id: ledgerId,
      p_beneficiary_id: beneficiaryId,
      p_amount_thb: amountThb,
      p_tx_type: txType,
      p_payout_to_internal_ratio: payoutToInternalRatio,
      p_earned_at: earnedAt,
      p_unlock_at: creditOnly ? null : params.unlockAt ?? null,
      p_metadata_patch: mergedPatch,
      p_wallet_metadata: {
        bookingId,
        ledgerId,
        txType,
      },
      p_credit_only: creditOnly,
    })

    if (error) {
      return {
        success: false,
        error: error.message || 'REFERRAL_DISTRIBUTE_ATOMIC_RPC_FAILED',
        ledgerId,
      }
    }

    const result = Array.isArray(data) ? data[0] : data
    const applied = result?.applied === true
    const walletApplied = result?.wallet_applied === true
    const reason = String(result?.reason || '')

    return {
      success: applied,
      applied,
      walletApplied,
      reason,
      walletReason: result?.wallet_reason || null,
      ledgerId,
      transactionId: result?.transaction_id || null,
      deficitRecoveredThb: round2(result?.deficit_recovered_thb),
      netCreditThb: round2(result?.net_credit_thb),
      internalCreditsDeltaThb: round2(result?.internal_credits_delta_thb),
      withdrawableDeltaThb: round2(result?.withdrawable_delta_thb),
      skippedWallet:
        applied &&
        !walletApplied &&
        (reason === 'CREDIT_APPLIED_TO_DEFICIT' ||
          reason === 'WALLET_ALREADY_APPLIED' ||
          reason === 'ALREADY_EARNED'),
    }
  } catch (e) {
    return {
      success: false,
      error: e?.message || String(e),
      ledgerId,
    }
  }
}

/**
 * Fail-fast when atomic RPC returns success:false (Stage 151.2).
 * Idempotent skips (already applied / deficit-only) pass when success:true.
 *
 * @param {object | null | undefined} result
 * @param {{ bookingId?: string, ledgerId?: string, operation?: string }} [ctx]
 */
export function assertReferralAtomicCreditResult(result, ctx = {}) {
  const bookingId = String(ctx.bookingId || '?')
  const ledgerId = String(ctx.ledgerId || result?.ledgerId || '?')
  const operation = String(ctx.operation || 'referral_atomic_credit')
  const prefix = `${operation}:booking=${bookingId}:ledger=${ledgerId}`

  if (!result || typeof result !== 'object') {
    throw new Error(`REFERRAL_ATOMIC_CREDIT_FAILED:${prefix}:empty_result`)
  }
  if (result.success === false) {
    const detail = String(result.error || result.reason || 'UNKNOWN')
    throw new Error(`REFERRAL_ATOMIC_CREDIT_FAILED:${prefix}:${detail}`)
  }
}

export default {
  distributeReferralLedgerCreditAtomic,
  assertReferralAtomicCreditResult,
  resolveTxTypeForLedgerRow,
}
