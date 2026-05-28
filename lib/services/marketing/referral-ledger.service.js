import { supabaseAdmin } from '@/lib/supabase'
import WalletService from '@/lib/services/finance/wallet.service'
import { recordCriticalSignal } from '@/lib/critical-telemetry.js'
import { notifyReferralBonusEarned } from '@/lib/services/marketing/referral-notification.service.js'
import { ReferralPromoTankReversalService } from '@/lib/services/marketing/referral-promo-tank-reversal.service.js'
import { REFERRAL_STATUSES } from '@/lib/services/marketing/referral-calculation.js'
import { logReferralFinancialOperation } from '@/lib/services/marketing/referral-financial-telemetry.js'
import {
  adjustHeldReferralBalanceThb,
  beneficiaryIdForLedgerRow,
  computeReferralUnlockAt,
} from '@/lib/services/marketing/referral-hold.service.js'

const REFERRAL_TYPES = Object.freeze({
  REFERRER_BONUS: 'bonus',
  REFEREE_CASHBACK: 'cashback',
})

const TERMINAL_LEDGER_STATUSES = new Set([
  REFERRAL_STATUSES.CANCELED,
  REFERRAL_STATUSES.CANCELED_DEFICIT,
])

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

/**
 * @param {object} row referral_ledger row
 * @param {{ trigger?: string, bookingId?: string, adminNote?: string }} options
 */
async function clawbackOneEarnedRow(row, options = {}) {
  const ledgerId = String(row.id || '').trim()
  const bookingId = String(options.bookingId || row.booking_id || '')
  const trigger = String(options?.trigger || 'booking_cancel')
  const amount = round2(row?.amount_thb)
  if (!ledgerId || amount <= 0) {
    return { ok: false, ledgerId, reason: 'INVALID_ROW' }
  }

  const txType =
    String(row?.type || '').toLowerCase() === REFERRAL_TYPES.REFERRER_BONUS
      ? 'referral_bonus'
      : 'referral_cashback'
  const beneficiaryId =
    txType === 'referral_bonus' ? String(row?.referrer_id || '') : String(row?.referee_id || '')
  if (!beneficiaryId) return { ok: false, ledgerId, reason: 'NO_BENEFICIARY' }

  const walletRes = await WalletService.clawbackReferralLedgerCredit({
    userId: beneficiaryId,
    ledgerId,
    amountThb: amount,
    txType,
    bookingId,
    trigger,
  })

  const prevMeta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  const nowIso = new Date().toISOString()

  const walletApplied = walletRes?.data?.applied === true
  const walletSkipped =
    walletRes?.success === true &&
    (walletRes?.skipped === true || walletRes?.data?.reason === 'CREDIT_NEVER_APPLIED')
  const walletDeficit = walletRes?.data?.deficit === true || walletRes?.deficit === true

  if (!walletApplied && !walletSkipped && !walletDeficit) {
    logReferralFinancialOperation('clawback', {
      ok: false,
      bookingId,
      ledgerId,
      beneficiaryId,
      amountThb: amount,
      trigger,
      reason: walletRes?.error || walletRes?.data?.reason || 'unknown',
    })
    recordCriticalSignal('REFERRAL_CLAWBACK_INSUFFICIENT', {
      threshold: 1,
      windowMs: 60_000,
      tag: '[REFERRAL_CLAWBACK]',
      detailLines: [
        `bookingId: ${bookingId}`,
        `ledgerId: ${ledgerId}`,
        `beneficiaryId: ${beneficiaryId}`,
        `amountThb: ${amount}`,
        `reason: ${walletRes?.error || walletRes?.data?.reason || 'unknown'}`,
        `trigger: ${trigger}`,
      ],
    })
    return {
      ok: false,
      ledgerId,
      reason: walletRes?.error || walletRes?.data?.reason || 'WALLET_CLAWBACK_FAILED',
    }
  }

  const nextStatus = walletDeficit ? REFERRAL_STATUSES.CANCELED_DEFICIT : REFERRAL_STATUSES.CANCELED
  const deficitThb = walletDeficit ? round2(walletRes?.data?.deficitThb ?? amount) : 0

  const { error: upErr } = await supabaseAdmin
    .from('referral_ledger')
    .update({
      status: nextStatus,
      canceled_at: nowIso,
      updated_at: nowIso,
      metadata: {
        ...prevMeta,
        clawback_at: nowIso,
        clawback_trigger: trigger,
        clawback_wallet_applied: walletApplied,
        clawback_wallet_skipped: walletSkipped ? walletRes?.reason || walletRes?.data?.reason : null,
        ...(walletDeficit
          ? {
              deficit_thb: deficitThb,
              deficit_recorded_at: nowIso,
            }
          : {}),
        ...(options?.adminNote ? { admin_note: String(options.adminNote) } : {}),
      },
    })
    .eq('id', ledgerId)
    .eq('status', REFERRAL_STATUSES.EARNED)

  if (upErr) {
    logReferralFinancialOperation('clawback', {
      ok: false,
      bookingId,
      ledgerId,
      trigger,
      reason: upErr.message || 'LEDGER_CANCEL_UPDATE_FAILED',
    })
    return { ok: false, ledgerId, reason: upErr.message || 'LEDGER_CANCEL_UPDATE_FAILED' }
  }

  logReferralFinancialOperation('clawback', {
    ok: true,
    bookingId,
    ledgerId,
    beneficiaryId,
    amountThb: amount,
    trigger,
    walletApplied,
    walletSkipped,
    walletDeficit,
    deficitThb: walletDeficit ? deficitThb : 0,
    ledgerStatus: nextStatus,
  })

  return { ok: true, ledgerId, deficit: walletDeficit, deficitThb }
}

/**
 * @param {object} row referral_ledger row (earned_held)
 * @param {{ trigger?: string, bookingId?: string, adminNote?: string }} options
 */
async function cancelOneHeldRow(row, options = {}) {
  const ledgerId = String(row.id || '').trim()
  const bookingId = String(options.bookingId || row.booking_id || '')
  const trigger = String(options?.trigger || 'booking_cancel')
  const amount = round2(row?.amount_thb)
  if (!ledgerId || amount <= 0) {
    return { ok: false, ledgerId, reason: 'INVALID_ROW' }
  }

  const beneficiaryId = beneficiaryIdForLedgerRow(row)
  if (!beneficiaryId) return { ok: false, ledgerId, reason: 'NO_BENEFICIARY' }

  const prevMeta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  if (prevMeta.clawback_at || TERMINAL_LEDGER_STATUSES.has(String(row.status || '').toLowerCase())) {
    return { ok: true, ledgerId, skipped: true, reason: 'ALREADY_CANCELED' }
  }

  const nowIso = new Date().toISOString()
  const { error: upErr } = await supabaseAdmin
    .from('referral_ledger')
    .update({
      status: REFERRAL_STATUSES.CANCELED,
      canceled_at: nowIso,
      updated_at: nowIso,
      unlock_at: null,
      metadata: {
        ...prevMeta,
        clawback_at: nowIso,
        clawback_trigger: trigger,
        clawback_wallet_applied: false,
        clawback_wallet_skipped: 'CREDIT_NEVER_APPLIED_HELD',
        ...(options?.adminNote ? { admin_note: String(options.adminNote) } : {}),
      },
    })
    .eq('id', ledgerId)
    .eq('status', REFERRAL_STATUSES.EARNED_HELD)

  if (upErr) {
    return { ok: false, ledgerId, reason: upErr.message || 'HELD_CANCEL_UPDATE_FAILED' }
  }

  await adjustHeldReferralBalanceThb(beneficiaryId, -amount)

  logReferralFinancialOperation('clawback', {
    ok: true,
    bookingId,
    ledgerId,
    beneficiaryId,
    amountThb: amount,
    trigger,
    walletApplied: false,
    walletSkipped: true,
    ledgerStatus: REFERRAL_STATUSES.CANCELED,
    heldCancel: true,
  })

  return { ok: true, ledgerId, heldCancel: true }
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
    attributionId = null,
  }) {
    const attrMeta =
      attributionId != null && String(attributionId).trim() !== ''
        ? { attribution_id: String(attributionId).trim() }
        : {};
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
          ...attrMeta,
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
          ...attrMeta,
        },
      },
    ]
    const { error } = await supabaseAdmin.from('referral_ledger').upsert(rows, {
      onConflict: 'booking_id,type,referral_type,referrer_id',
      ignoreDuplicates: false,
    })
    if (error) throw new Error(error.message || 'REFERRAL_LEDGER_UPSERT_FAILED')
  }

  static async markPendingAsEarned(bookingId, options = {}) {
    const bid = String(bookingId)
    const nowIso = new Date().toISOString()
    const holdDays = Math.max(0, Math.floor(Number(options.referralHoldDays) || 0))
    const completedAt =
      options.completedAt != null && String(options.completedAt).trim() !== ''
        ? String(options.completedAt)
        : nowIso
    const unlockAt = holdDays > 0 ? computeReferralUnlockAt(completedAt, holdDays) : null
    const nextStatus = holdDays > 0 ? REFERRAL_STATUSES.EARNED_HELD : REFERRAL_STATUSES.EARNED

    const { data: pendingRows, error: readErr } = await supabaseAdmin
      .from('referral_ledger')
      .select('id,metadata,amount_thb,type,referrer_id,referee_id')
      .eq('booking_id', bid)
      .eq('status', REFERRAL_STATUSES.PENDING)
    if (readErr) throw new Error(readErr.message || 'REFERRAL_LEDGER_PENDING_READ_FAILED')

    const toEarn = (pendingRows || []).filter((row) => row?.metadata?.admin_hold !== true)
    if (!toEarn.length) return { held: holdDays > 0, count: 0 }

    const earnIds = toEarn.map((row) => String(row.id || '')).filter(Boolean)
    const { error } = await supabaseAdmin
      .from('referral_ledger')
      .update({
        status: nextStatus,
        earned_at: nowIso,
        updated_at: nowIso,
        unlock_at: unlockAt,
      })
      .in('id', earnIds)
      .eq('status', REFERRAL_STATUSES.PENDING)
    if (error) throw new Error(error.message || 'REFERRAL_LEDGER_EARNED_UPDATE_FAILED')

    if (nextStatus === REFERRAL_STATUSES.EARNED_HELD) {
      for (const row of toEarn) {
        const beneficiaryId = beneficiaryIdForLedgerRow(row)
        const amount = round2(row?.amount_thb)
        if (beneficiaryId && amount > 0) {
          await adjustHeldReferralBalanceThb(beneficiaryId, amount)
        }
      }
    }

    return { held: nextStatus === REFERRAL_STATUSES.EARNED_HELD, count: earnIds.length }
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
    if (prevMeta.clawback_at || TERMINAL_LEDGER_STATUSES.has(String(row.status || '').toLowerCase())) {
      return { success: true, skipped: true, reason: 'ALREADY_CLAWED_BACK', ledgerId: id }
    }

    const result = await clawbackOneEarnedRow(row, {
      trigger,
      bookingId: row.booking_id,
      adminNote: options?.adminNote,
    })
    if (!result.ok) {
      return { success: false, error: result.reason || 'WALLET_CLAWBACK_FAILED', ledgerId: id }
    }

    return {
      success: true,
      clawedBackCount: 1,
      ledgerId: id,
      deficit: result.deficit === true,
      deficitThb: result.deficitThb,
    }
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
      .select('id, booking_id, referrer_id, referee_id, amount_thb, type, status, referral_type, metadata')
      .eq('booking_id', id)
      .eq('status', REFERRAL_STATUSES.EARNED)
    if (error) return { success: false, error: error.message || 'REFERRAL_LEDGER_EARNED_READ_FAILED' }

    const earned = (rows || []).filter((row) => {
      const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}
      return !meta.clawback_at
    })
    if (!earned.length) {
      return { success: true, clawedBackCount: 0, deficitCount: 0, skipped: true, reason: 'NO_EARNED_ROWS' }
    }

    let clawedBackCount = 0
    let deficitCount = 0
    const failures = []

    for (const row of earned) {
      const result = await clawbackOneEarnedRow(row, { trigger, bookingId: id })
      if (!result.ok) {
        failures.push({ ledgerId: result.ledgerId, reason: result.reason })
        continue
      }
      clawedBackCount += 1
      if (result.deficit) deficitCount += 1
    }

    return {
      success: failures.length === 0,
      clawedBackCount,
      deficitCount,
      failureCount: failures.length,
      failures: failures.length ? failures : undefined,
    }
  }

  /** pending cancel + earned clawback + promo tank reversal (Stage 119.1). */
  static async revertReferralLedgerForBooking(bookingId, options = {}) {
    const id = String(bookingId || '').trim()
    const trigger = String(options?.trigger || 'booking_cancel')

    let promoTank = null
    try {
      promoTank = await ReferralPromoTankReversalService.revertPromoTankDebitsForBooking(id, {
        trigger,
      })
    } catch (e) {
      console.warn('[REFERRAL] promo tank reversal', id, e?.message || e)
      promoTank = { success: false, error: e?.message || String(e) }
    }

    const pending = await this.cancelPendingLedgerForBooking(id)
    const clawback = await this.clawbackEarnedLedgerForBooking(id, options)
    const heldCancel = await this.cancelHeldLedgerForBooking(id, options)
    return {
      success:
        pending.success !== false && clawback.success !== false && heldCancel.success !== false,
      promoTank,
      pending,
      clawback,
      heldCancel,
    }
  }

  /** Stage 121.1 — cancel earned_held without wallet clawback (credit never applied). */
  static async cancelHeldLedgerForBooking(bookingId, options = {}) {
    const id = String(bookingId || '').trim()
    if (!id) return { success: false, error: 'BOOKING_ID_REQUIRED' }
    const trigger = String(options?.trigger || 'booking_cancel')

    const { data: rows, error } = await supabaseAdmin
      .from('referral_ledger')
      .select('id, booking_id, referrer_id, referee_id, amount_thb, type, status, metadata')
      .eq('booking_id', id)
      .eq('status', REFERRAL_STATUSES.EARNED_HELD)
    if (error) return { success: false, error: error.message || 'REFERRAL_LEDGER_HELD_READ_FAILED' }

    const held = (rows || []).filter((row) => {
      const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}
      return !meta.clawback_at
    })
    if (!held.length) {
      return { success: true, canceledCount: 0, skipped: true, reason: 'NO_HELD_ROWS' }
    }

    let canceledCount = 0
    const failures = []
    for (const row of held) {
      const result = await cancelOneHeldRow(row, { trigger, bookingId: id })
      if (!result.ok) {
        failures.push({ ledgerId: result.ledgerId, reason: result.reason })
        continue
      }
      if (!result.skipped) canceledCount += 1
    }

    return {
      success: failures.length === 0,
      canceledCount,
      failureCount: failures.length,
      failures: failures.length ? failures : undefined,
    }
  }

  /**
   * Stage 121.1 — earned_held → earned + wallet credit (idempotent per row).
   * @param {string} bookingId
   * @param {{ force?: boolean }} [options] force skips unlock_at check (smoke/tests only)
   */
  static async unlockHeldRowsForBooking(bookingId, options = {}) {
    const id = String(bookingId || '').trim()
    if (!id) return { success: false, error: 'BOOKING_ID_REQUIRED' }
    const nowIso = new Date().toISOString()
    const force = options.force === true

    let q = supabaseAdmin
      .from('referral_ledger')
      .select('id, booking_id, referrer_id, referee_id, amount_thb, type, status, unlock_at, metadata')
      .eq('booking_id', id)
      .eq('status', REFERRAL_STATUSES.EARNED_HELD)
    if (!force) q = q.lte('unlock_at', nowIso)

    const { data: rows, error } = await q
    if (error) return { success: false, error: error.message || 'REFERRAL_LEDGER_HELD_READ_FAILED' }
    if (!rows?.length) {
      return { success: true, unlockedCount: 0, skipped: true, reason: 'NO_ROWS_READY' }
    }

    const ids = rows.map((r) => String(r.id)).filter(Boolean)
    const { error: upErr } = await supabaseAdmin
      .from('referral_ledger')
      .update({
        status: REFERRAL_STATUSES.EARNED,
        earned_at: nowIso,
        updated_at: nowIso,
        unlock_at: null,
      })
      .in('id', ids)
      .eq('status', REFERRAL_STATUSES.EARNED_HELD)
    if (upErr) return { success: false, error: upErr.message || 'REFERRAL_LEDGER_UNLOCK_FAILED' }

    for (const row of rows) {
      const beneficiaryId = beneficiaryIdForLedgerRow(row)
      const amount = round2(row?.amount_thb)
      if (beneficiaryId && amount > 0) {
        await adjustHeldReferralBalanceThb(beneficiaryId, -amount)
      }
    }

    await this.creditWalletFromEarnedRows(id)

    return { success: true, unlockedCount: rows.length, bookingId: id }
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
