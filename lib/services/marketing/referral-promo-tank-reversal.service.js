/**
 * Stage 119.1 — идемпотентный возврат promo tank debits при отмене брони (SSOT reversal).
 */
import { supabaseAdmin } from '@/lib/supabase'
import { ReferralPromoTankService } from '@/lib/services/marketing/referral-promo-tank.service.js'
import { logReferralFinancialOperation } from '@/lib/services/marketing/referral-financial-telemetry.js'

const DEBIT_TO_REVERSAL = Object.freeze({
  referral_boost_debit: 'referral_boost_reversal',
  host_activation_bonus_debit: 'host_activation_reversal',
})

function round2(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

export class ReferralPromoTankReversalService {
  /**
   * Возвращает в pot суммы ранее списанных turbo boost / host activation по booking_id.
   * Идемпотентно: UNIQUE (booking_id, entry_type) на reversal-записях.
   */
  static async revertPromoTankDebitsForBooking(bookingId, options = {}) {
    const id = String(bookingId || '').trim()
    if (!id) return { success: false, error: 'BOOKING_ID_REQUIRED' }

    const trigger = String(options?.trigger || 'booking_cancel')
    const debitTypes = Object.keys(DEBIT_TO_REVERSAL)

    const { data: rows, error } = await supabaseAdmin
      .from('marketing_promo_tank_ledger')
      .select('entry_type, amount_thb')
      .eq('booking_id', id)
      .in('entry_type', debitTypes)

    if (error) return { success: false, error: error.message || 'PROMO_TANK_READ_FAILED' }

    const reversals = []
    for (const row of rows || []) {
      const debitType = String(row.entry_type || '')
      const reversalType = DEBIT_TO_REVERSAL[debitType]
      if (!reversalType) continue

      const debitAbs = round2(Math.abs(Number(row.amount_thb) || 0))
      if (debitAbs <= 0) continue

      const adjust = await ReferralPromoTankService.adjustMarketingPromoPot(debitAbs, reversalType, {
        bookingId: id,
        metadata: {
          trigger,
          reversed_debit_entry_type: debitType,
          reversed_amount_thb: debitAbs,
        },
      })

      const applied = adjust?.applied === true
      const idempotent =
        !applied &&
        String(adjust?.reason || '')
          .toUpperCase()
          .includes('DUPLICATE')

      reversals.push({
        debitType,
        reversalType,
        amountThb: debitAbs,
        applied: applied || idempotent,
        idempotent,
        reason: adjust?.reason || null,
        newBalanceThb: adjust?.newBalanceThb ?? null,
      })

      logReferralFinancialOperation('promo_tank_reversal', {
        ok: applied || idempotent,
        bookingId: id,
        trigger,
        debitType,
        reversalType,
        amountThb: debitAbs,
        applied: applied || idempotent,
        idempotent,
        reason: adjust?.reason || null,
      })
    }

    const appliedCount = reversals.filter((r) => r.applied).length
    if (reversals.length === 0) {
      logReferralFinancialOperation('promo_tank_reversal', {
        ok: true,
        bookingId: id,
        trigger,
        skipped: true,
        reason: 'NO_DEBITS',
      })
    }

    return {
      success: true,
      bookingId: id,
      reversalCount: appliedCount,
      reversals,
      skipped: reversals.length === 0,
    }
  }
}

export default ReferralPromoTankReversalService
