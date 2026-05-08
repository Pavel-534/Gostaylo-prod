import { supabaseAdmin } from '@/lib/supabase'
import WalletService from '@/lib/services/finance/wallet.service'

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
    const nowIso = new Date().toISOString()
    const { error } = await supabaseAdmin
      .from('referral_ledger')
      .update({
        status: REFERRAL_STATUSES.EARNED,
        earned_at: nowIso,
        updated_at: nowIso,
      })
      .eq('booking_id', String(bookingId))
      .eq('status', REFERRAL_STATUSES.PENDING)
    if (error) throw new Error(error.message || 'REFERRAL_LEDGER_EARNED_UPDATE_FAILED')
  }

  static async cancelPendingLedgerForBooking(bookingId) {
    const id = String(bookingId || '').trim()
    if (!id) return { success: false, error: 'BOOKING_ID_REQUIRED' }
    const nowIso = new Date().toISOString()
    const { data, error } = await supabaseAdmin
      .from('referral_ledger')
      .update({
        status: REFERRAL_STATUSES.CANCELED,
        updated_at: nowIso,
      })
      .eq('booking_id', id)
      .eq('status', REFERRAL_STATUSES.PENDING)
      .select('id')
    if (error) return { success: false, error: error.message }
    return { success: true, canceledCount: Array.isArray(data) ? data.length : 0 }
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
      await WalletService.addFunds(beneficiaryId, amount, txType, `referral_ledger:${String(row.id)}`, {
        bookingId: String(bookingId),
        ledgerId: String(row.id),
        txType,
      })
    }
  }
}

export default ReferralLedgerService
