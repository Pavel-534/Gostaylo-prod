import { supabaseAdmin } from '@/lib/supabase'
import WalletService from '@/lib/services/finance/wallet.service'
import { recordCriticalSignal } from '@/lib/critical-telemetry.js'
import { notifyReferralBonusEarned } from '@/lib/services/marketing/referral-notification.service.js'

const REFERRAL_TYPES = Object.freeze({
  REFERRER_BONUS: 'bonus',
  REFEREE_CASHBACK: 'cashback',
})

const REFERRAL_STATUSES = Object.freeze({
  PENDING: 'pending',
  EARNED: 'earned',
  CANCELED: 'canceled',
})

function round2(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function clamp(value, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export class ReferralLedgerService {
  static async createPendingLedgerRows({
    booking,
    relation,
    referralPoolThb,
    referrerAmountThb,
    refereeAmountThb,
    netProfitOrderThb,
    platformGrossRevenueThb,
    promoBoostThb = 0,
    policy,
    trigger,
    referralType,
  }) {
    const ledgerDepth = clamp(Number(relation?.network_depth) || 1, 1, 32)
    const rows = [
      {
        id: makeId('rfl'),
        booking_id: String(booking.id),
        referrer_id: String(relation.referrer_id),
        referee_id: String(relation.referee_id),
        amount_thb: referrerAmountThb,
        type: REFERRAL_TYPES.REFERRER_BONUS,
        referral_type: String(referralType || 'guest_booking'),
        ledger_depth: ledgerDepth,
        status: REFERRAL_STATUSES.PENDING,
        net_profit_order_thb: netProfitOrderThb,
        platform_gross_thb: platformGrossRevenueThb,
        referral_pool_thb: referralPoolThb,
        metadata: {
          split_role: 'referrer',
          policy,
          promo_boost_thb: round2(promoBoostThb),
          trigger,
        },
      },
      {
        id: makeId('rfl'),
        booking_id: String(booking.id),
        referrer_id: String(relation.referrer_id),
        referee_id: String(relation.referee_id),
        amount_thb: refereeAmountThb,
        type: REFERRAL_TYPES.REFEREE_CASHBACK,
        referral_type: String(referralType || 'guest_booking'),
        ledger_depth: ledgerDepth,
        status: REFERRAL_STATUSES.PENDING,
        net_profit_order_thb: netProfitOrderThb,
        platform_gross_thb: platformGrossRevenueThb,
        referral_pool_thb: referralPoolThb,
        metadata: {
          split_role: 'referee',
          policy,
          promo_boost_thb: round2(promoBoostThb),
          trigger,
        },
      },
    ]
    const { error } = await supabaseAdmin.from('referral_ledger').upsert(rows, {
      onConflict: 'booking_id,type,referral_type,referrer_id',
      ignoreDuplicates: false,
    })
    if (error) throw new Error(error.message || 'REFERRAL_LEDGER_UPSERT_FAILED')
  }

  static async markPendingAsEarned(bookingId) {
    const bid = String(bookingId)
    const nowIso = new Date().toISOString()
    const { data: pendingRows, error: readErr } = await supabaseAdmin
      .from('referral_ledger')
      .select('id,metadata')
      .eq('booking_id', bid)
      .eq('status', REFERRAL_STATUSES.PENDING)
    if (readErr) throw new Error(readErr.message || 'REFERRAL_LEDGER_PENDING_READ_FAILED')

    const earnIds = (pendingRows || [])
      .filter((row) => row?.metadata?.admin_hold !== true)
      .map((row) => String(row.id || ''))
      .filter(Boolean)
    if (!earnIds.length) return

    const { error } = await supabaseAdmin
      .from('referral_ledger')
      .update({
        status: REFERRAL_STATUSES.EARNED,
        earned_at: nowIso,
        updated_at: nowIso,
      })
      .in('id', earnIds)
    if (error) throw new Error(error.message || 'REFERRAL_LEDGER_EARNED_UPDATE_FAILED')
  }

  /** Stage 114.5 — admin reject одной earned-строки (не трогает другие строки брони). */
  static async clawbackSingleEarnedRow(ledgerId, options = {}) {
    const id = String(ledgerId || '').trim()
    if (!id) return { success: false, error: 'LEDGER_ID_REQUIRED' }
    const trigger = String(options?.trigger || 'admin_reject')

    const { data: row, error } = await supabaseAdmin
      .from('referral_ledger')
      .select('id, booking_id, referrer_id, referee_id, amount_thb, type, status, metadata')
      .eq('id', id)
      .maybeSingle()
    if (error) return { success: false, error: error.message || 'LEDGER_READ_FAILED' }
    if (!row?.id) return { success: false, error: 'NOT_FOUND' }
    if (String(row.status || '').toLowerCase() !== REFERRAL_STATUSES.EARNED) {
      return { success: false, error: 'NOT_EARNED', status: row.status }
    }

    const prevMeta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}
    if (prevMeta.clawback_at) {
      return { success: true, skipped: true, reason: 'ALREADY_CLAWED_BACK', ledgerId: id }
    }

    const bookingId = String(row.booking_id || '')
    const amount = round2(row?.amount_thb)
    const txType =
      String(row?.type || '').toLowerCase() === REFERRAL_TYPES.REFERRER_BONUS
        ? 'referral_bonus'
        : 'referral_cashback'
    const beneficiaryId =
      txType === 'referral_bonus' ? String(row?.referrer_id || '') : String(row?.referee_id || '')
    if (!beneficiaryId || amount <= 0) {
      return { success: false, error: 'INVALID_LEDGER_ROW' }
    }

    const walletRes = await WalletService.clawbackReferralLedgerCredit({
      userId: beneficiaryId,
      ledgerId: id,
      amountThb: amount,
      txType,
      bookingId,
      trigger,
    })
    const walletOk =
      walletRes?.success === true &&
      (walletRes?.data?.applied === true || walletRes?.skipped === true)
    if (!walletOk && walletRes?.data?.reason !== 'CREDIT_NEVER_APPLIED') {
      return {
        success: false,
        error: walletRes?.error || walletRes?.data?.reason || 'WALLET_CLAWBACK_FAILED',
      }
    }

    const nowIso = new Date().toISOString()
    const { error: upErr } = await supabaseAdmin
      .from('referral_ledger')
      .update({
        status: REFERRAL_STATUSES.CANCELED,
        canceled_at: nowIso,
        updated_at: nowIso,
        metadata: {
          ...prevMeta,
          clawback_at: nowIso,
          clawback_trigger: trigger,
          admin_note: options?.adminNote ? String(options.adminNote) : prevMeta.admin_note || null,
          admin_rejected_at: nowIso,
        },
      })
      .eq('id', id)
      .eq('status', REFERRAL_STATUSES.EARNED)
    if (upErr) return { success: false, error: upErr.message || 'LEDGER_CANCEL_UPDATE_FAILED' }

    return { success: true, clawedBackCount: 1, ledgerId: id }
  }

  static async cancelPendingLedgerForBooking(bookingId) {
    const id = String(bookingId || '').trim()
    if (!id) return { success: false, error: 'BOOKING_ID_REQUIRED' }
    const nowIso = new Date().toISOString()
    const { data, error } = await supabaseAdmin
      .from('referral_ledger')
      .update({
        status: REFERRAL_STATUSES.CANCELED,
        canceled_at: nowIso,
        updated_at: nowIso,
      })
      .eq('booking_id', id)
      .eq('status', REFERRAL_STATUSES.PENDING)
      .select('id')
    if (error) return { success: false, error: error.message }
    return { success: true, canceledCount: Array.isArray(data) ? data.length : 0 }
  }

  /**
   * Stage 114.1 — clawback earned referral rows: idempotent wallet debit per `referral_ledger.id`, then cancel row.
   */
  static async clawbackEarnedLedgerForBooking(bookingId, options = {}) {
    const id = String(bookingId || '').trim()
    if (!id) return { success: false, error: 'BOOKING_ID_REQUIRED' }
    const trigger = String(options?.trigger || 'booking_cancel')

    const { data: rows, error } = await supabaseAdmin
      .from('referral_ledger')
      .select('id, referrer_id, referee_id, amount_thb, type, status, referral_type, metadata')
      .eq('booking_id', id)
      .eq('status', REFERRAL_STATUSES.EARNED)
    if (error) return { success: false, error: error.message || 'REFERRAL_LEDGER_EARNED_READ_FAILED' }

    const earned = (rows || []).filter((row) => {
      const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}
      return !meta.clawback_at
    })
    if (!earned.length) {
      return { success: true, clawedBackCount: 0, skipped: true, reason: 'NO_EARNED_ROWS' }
    }

    const nowIso = new Date().toISOString()
    let clawedBackCount = 0
    const failures = []

    for (const row of earned) {
      const ledgerId = String(row.id || '').trim()
      const amount = round2(row?.amount_thb)
      if (!ledgerId || amount <= 0) continue

      const txType =
        String(row?.type || '').toLowerCase() === REFERRAL_TYPES.REFERRER_BONUS
          ? 'referral_bonus'
          : 'referral_cashback'
      const beneficiaryId =
        txType === 'referral_bonus' ? String(row?.referrer_id || '') : String(row?.referee_id || '')
      if (!beneficiaryId) continue

      const walletRes = await WalletService.clawbackReferralLedgerCredit({
        userId: beneficiaryId,
        ledgerId,
        amountThb: amount,
        txType,
        bookingId: id,
        trigger,
      })

      const walletOk =
        walletRes?.success === true &&
        (walletRes?.data?.applied === true || walletRes?.skipped === true)
      if (!walletOk && walletRes?.data?.reason !== 'CREDIT_NEVER_APPLIED') {
        failures.push({
          ledgerId,
          reason: walletRes?.error || walletRes?.data?.reason || 'WALLET_CLAWBACK_FAILED',
        })
        recordCriticalSignal('REFERRAL_CLAWBACK_INSUFFICIENT', {
          threshold: 1,
          windowMs: 60_000,
          tag: '[REFERRAL_CLAWBACK]',
          detailLines: [
            `bookingId: ${id}`,
            `ledgerId: ${ledgerId}`,
            `beneficiaryId: ${beneficiaryId}`,
            `amountThb: ${amount}`,
            `reason: ${walletRes?.error || walletRes?.data?.reason || 'unknown'}`,
            `trigger: ${trigger}`,
          ],
        })
        continue
      }

      const prevMeta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}
      const { error: upErr } = await supabaseAdmin
        .from('referral_ledger')
        .update({
          status: REFERRAL_STATUSES.CANCELED,
          canceled_at: nowIso,
          updated_at: nowIso,
          metadata: {
            ...prevMeta,
            clawback_at: nowIso,
            clawback_trigger: trigger,
            clawback_wallet_applied: walletRes?.data?.applied === true,
            clawback_wallet_skipped: walletRes?.skipped === true ? walletRes.reason : null,
          },
        })
        .eq('id', ledgerId)
        .eq('status', REFERRAL_STATUSES.EARNED)
      if (upErr) {
        failures.push({ ledgerId, reason: upErr.message || 'LEDGER_CANCEL_UPDATE_FAILED' })
        continue
      }
      clawedBackCount += 1
    }

    return {
      success: failures.length === 0,
      clawedBackCount,
      failureCount: failures.length,
      failures: failures.length ? failures : undefined,
    }
  }

  /** pending cancel + earned clawback (Stage 114.1). */
  static async revertReferralLedgerForBooking(bookingId, options = {}) {
    const pending = await this.cancelPendingLedgerForBooking(bookingId)
    const clawback = await this.clawbackEarnedLedgerForBooking(bookingId, options)
    return {
      success: pending.success !== false && clawback.success !== false,
      pending,
      clawback,
    }
  }

  static async creditWalletFromEarnedRows(bookingId) {
    const { data, error } = await supabaseAdmin
      .from('referral_ledger')
      .select('id,referrer_id,referee_id,amount_thb,type,status')
      .eq('booking_id', String(bookingId))
      .eq('status', REFERRAL_STATUSES.EARNED)
    if (error) throw new Error(error.message || 'REFERRAL_LEDGER_EARNED_READ_FAILED')

    for (const row of data || []) {
      const amount = round2(row?.amount_thb)
      if (amount <= 0) continue
      const txType =
        String(row?.type || '').toLowerCase() === REFERRAL_TYPES.REFERRER_BONUS
          ? 'referral_bonus'
          : 'referral_cashback'
      const beneficiaryId =
        txType === 'referral_bonus' ? String(row?.referrer_id || '') : String(row?.referee_id || '')
      if (!beneficiaryId) continue
      const credit = await WalletService.addFunds(beneficiaryId, amount, txType, `referral_ledger:${String(row.id)}`, {
        bookingId: String(bookingId),
        ledgerId: String(row.id),
        txType,
      })
      if (credit?.success && credit?.data?.applied === true) {
        void notifyReferralBonusEarned({
          beneficiaryId,
          amountThb: amount,
          bookingId: String(bookingId),
          ledgerId: String(row.id),
          txType,
          ledgerDepth: row?.ledger_depth,
          referralType: row?.referral_type,
          referrerId: row?.referrer_id,
          refereeId: row?.referee_id,
        })
      }
    }
  }
}

export default ReferralLedgerService
