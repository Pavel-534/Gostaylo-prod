import { supabaseAdmin } from '@/lib/supabase'
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'
import { getReferralSettings, round2 } from '@/lib/services/marketing/referral-calculation.js'

function clamp(value, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

export class ReferralPromoTankService {
  /** Live promo tank balance from system settings (updated by adjust_marketing_promo_pot RPC). */
  static async getCurrentBalance() {
    const policy = await getReferralSettings()
    const balanceThb = round2(policy.marketingPromoPot)
    return {
      balanceThb,
      configuredBudgetThb: balanceThb,
      promoTurboModeEnabled: policy.promoTurboModeEnabled === true,
    }
  }

  static async adjustMarketingPromoPot(deltaThb, entryType, options = {}) {
    const delta = round2(deltaThb)
    if (!delta) return { applied: false, reason: 'ZERO_DELTA', newBalanceThb: null }
    const bookingId = options?.bookingId ? String(options.bookingId) : null
    const metadata = options?.metadata && typeof options.metadata === 'object' ? options.metadata : {}

    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('adjust_marketing_promo_pot', {
      p_delta_thb: delta,
      p_entry_type: String(entryType || ''),
      p_booking_id: bookingId,
      p_metadata: metadata,
    })

    if (rpcError) {
      const msg = String(rpcError?.message || '')
      if (/adjust_marketing_promo_pot|function/i.test(msg)) {
        return { applied: false, reason: 'MISSING_DB_FUNCTION', newBalanceThb: null }
      }
      throw new Error(rpcError.message || 'PROMO_POT_ADJUST_FAILED')
    }

    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData
    return {
      applied: row?.applied === true,
      reason: String(row?.reason || ''),
      newBalanceThb: Number.isFinite(Number(row?.new_balance_thb)) ? round2(row.new_balance_thb) : null,
    }
  }

  static async applyOrganicTopup({ booking, netBase, policy, trigger }) {
    const percent = clamp(policy?.organicToPromoPotPercent, 0, 100)
    if (percent <= 0) return { applied: false, amountThb: 0, reason: 'ORGANIC_TOPUP_DISABLED' }
    const amountThb = round2(netBase.netProfitOrderThb * (percent / 100))
    if (amountThb <= 0) return { applied: false, amountThb: 0, reason: 'ORGANIC_TOPUP_ZERO' }

    const adjust = await this.adjustMarketingPromoPot(amountThb, 'organic_topup', {
      bookingId: booking.id,
      metadata: {
        trigger,
        net_profit_order_thb: netBase.netProfitOrderThb,
        organic_to_promo_pot_percent: percent,
      },
    })
    return { ...adjust, amountThb }
  }

  static async applyPromoBoost({ booking, policy, baseReferralPoolThb }) {
    if (policy?.promoTurboModeEnabled !== true) {
      return { boostAppliedThb: 0, reason: 'TURBO_DISABLED', newBalanceThb: policy?.marketingPromoPot ?? 0 }
    }
    const requestedBoostThb = round2(policy?.promoBoostPerBooking)
    if (requestedBoostThb <= 0) {
      return { boostAppliedThb: 0, reason: 'BOOST_ZERO', newBalanceThb: policy?.marketingPromoPot ?? 0 }
    }
    const available = round2(policy?.marketingPromoPot)
    if (available <= 0) {
      return { boostAppliedThb: 0, reason: 'POT_EMPTY', newBalanceThb: 0 }
    }
    const boostAppliedThb = round2(Math.min(requestedBoostThb, available))
    if (boostAppliedThb <= 0) {
      return { boostAppliedThb: 0, reason: 'BOOST_ZERO', newBalanceThb: available }
    }

    const adjust = await this.adjustMarketingPromoPot(-boostAppliedThb, 'referral_boost_debit', {
      bookingId: booking.id,
      metadata: {
        base_referral_pool_thb: baseReferralPoolThb,
        requested_boost_thb: requestedBoostThb,
      },
    })
    if (!adjust.applied) {
      return {
        boostAppliedThb: 0,
        reason: adjust.reason || 'BOOST_DEBIT_NOT_APPLIED',
        newBalanceThb: adjust.newBalanceThb ?? available,
      }
    }
    return {
      boostAppliedThb,
      reason: 'APPLIED',
      newBalanceThb: adjust.newBalanceThb ?? round2(available - boostAppliedThb),
    }
  }

  static async handleHostActivationDebitFailure({ bookingId, bookingMetadata, bonusThb, balanceThb, reason }) {
    const id = String(bookingId || '')
    const meta =
      bookingMetadata && typeof bookingMetadata === 'object' ? { ...bookingMetadata } : {}
    meta.host_activation_promo_tank = {
      status: 'pending_tank_refill',
      required_thb: bonusThb,
      balance_thb_at_failure: Number.isFinite(Number(balanceThb)) ? round2(Number(balanceThb)) : null,
      reason,
      updated_at: new Date().toISOString(),
    }
    const { error: metaErr } = await supabaseAdmin.from('bookings').update({ metadata: meta }).eq('id', id)
    if (metaErr) {
      console.warn('[REFERRAL] host_activation metadata patch failed:', metaErr.message)
    }
    void notifySystemAlert(
      `🧯 <b>Promo tank: host activation blocked</b>\n` +
        `Booking <code>${escapeSystemAlertHtml(id)}</code>\n` +
        `Нужно <b>${escapeSystemAlertHtml(String(bonusThb))}</b> THB, в баке ≈ <b>${escapeSystemAlertHtml(
          Number.isFinite(Number(balanceThb)) ? String(round2(Number(balanceThb))) : '—',
        )}</b> THB\n` +
        `Причина: <code>${escapeSystemAlertHtml(String(reason || ''))}</code>\n` +
        `Статус брони: <code>pending_tank_refill</code> — пополните marketing promo pot и выполните retry (админка → retry host activation).`,
    )
  }

  static async processHostActivationDebit({
    bookingId,
    bookingMetadata,
    bonusThb,
    metadata,
  }) {
    const promoDebit = await this.adjustMarketingPromoPot(-bonusThb, 'host_activation_bonus_debit', {
      bookingId,
      metadata,
    })
    if (!promoDebit.applied) {
      const reason = String(promoDebit.reason || 'HOST_ACTIVATION_PROMO_DEBIT_NOT_APPLIED')
      await this.handleHostActivationDebitFailure({
        bookingId,
        bookingMetadata,
        bonusThb,
        balanceThb: promoDebit.newBalanceThb,
        reason,
      })
      return {
        success: true,
        skipped: true,
        reason: 'PENDING_TANK_REFILL',
        data: {
          bookingId,
          promoTankReason: reason,
          requiredThb: bonusThb,
          balanceThb: promoDebit.newBalanceThb,
        },
      }
    }
    return {
      success: true,
      skipped: false,
      promoDebit,
    }
  }
}

export default ReferralPromoTankService
