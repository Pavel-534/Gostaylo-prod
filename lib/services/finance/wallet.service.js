import { supabaseAdmin } from '@/lib/supabase';
import { PricingService } from '@/lib/services/pricing.service';

function round2(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function clamp(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export class WalletService {
  static async getOrCreateWallet(userId) {
    const uid = String(userId || '').trim();
    if (!uid) return { success: false, error: 'USER_ID_REQUIRED', status: 400 };
    const { data: existing, error: readError } = await supabaseAdmin
      .from('user_wallets')
      .select(
        'id,user_id,balance_thb,currency,welcome_bonus_remaining_thb,welcome_bonus_expires_at,updated_at,created_at',
      )
      .eq('user_id', uid)
      .maybeSingle();
    if (readError) return { success: false, error: readError.message || 'WALLET_READ_FAILED', status: 500 };
    if (existing?.id) {
      return { success: true, data: existing };
    }
    const row = {
      id: `wal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      user_id: uid,
      balance_thb: 0,
      currency: 'THB',
    };
    const { data, error } = await supabaseAdmin
      .from('user_wallets')
      .insert(row)
      .select(
        'id,user_id,balance_thb,currency,welcome_bonus_remaining_thb,welcome_bonus_expires_at,updated_at,created_at',
      )
      .single();
    if (error) {
      return { success: false, error: error.message || 'WALLET_CREATE_FAILED', status: 500 };
    }
    return { success: true, data };
  }

  static async applyOperation({
    userId,
    amountThb,
    operationType,
    type,
    referenceId = null,
    metadata = {},
    expiresAt = null,
  }) {
    const amount = round2(amountThb);
    if (amount <= 0) return { success: false, error: 'AMOUNT_MUST_BE_POSITIVE', status: 400 };
    const { data, error } = await supabaseAdmin.rpc('wallet_apply_operation', {
      p_user_id: String(userId || ''),
      p_amount_thb: amount,
      p_operation_type: String(operationType || ''),
      p_tx_type: String(type || 'wallet_operation'),
      p_reference_id: referenceId ? String(referenceId) : null,
      p_metadata: metadata && typeof metadata === 'object' ? metadata : {},
      p_expires_at: expiresAt ? String(expiresAt) : null,
    });
    if (error) {
      return { success: false, error: error.message || 'WALLET_OPERATION_FAILED', status: 500 };
    }
    const row = Array.isArray(data) ? data[0] : data;
    return {
      success: row?.applied === true,
      status: row?.applied === true ? 200 : row?.reason === 'INSUFFICIENT_FUNDS' ? 409 : 200,
      data: {
        applied: row?.applied === true,
        reason: String(row?.reason || ''),
        walletId: row?.wallet_id || null,
        balanceBeforeThb: round2(row?.balance_before_thb),
        balanceAfterThb: round2(row?.balance_after_thb),
        transactionId: row?.transaction_id || null,
      },
      error: row?.applied === true ? null : String(row?.reason || 'WALLET_OPERATION_REJECTED'),
    };
  }

  static async addFunds(userId, amountThb, type, referenceId = null, metadata = {}, expiresAt = null) {
    return this.applyOperation({
      userId,
      amountThb,
      operationType: 'credit',
      type,
      referenceId,
      metadata,
      expiresAt,
    });
  }

  /**
   * Welcome bonus must be tracked for expiry + FIFO burn against spends.
   * Call after successful `addFunds` with type `welcome_bonus`.
   */
  static async syncWelcomeBonusGrant(userId, amountThb, expiresAtIso) {
    const uid = String(userId || '').trim();
    const amt = round2(amountThb);
    if (!uid || amt <= 0 || !expiresAtIso) return { success: false, error: 'INVALID_WELCOME_GRANT' };
    const { error } = await supabaseAdmin
      .from('user_wallets')
      .update({
        welcome_bonus_remaining_thb: amt,
        welcome_bonus_expires_at: expiresAtIso,
        welcome_notify_5d_sent_at: null,
        welcome_notify_1d_sent_at: null,
      })
      .eq('user_id', uid);
    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  /**
   * After idempotent credit for booking-cancel wallet restore, re-attribute slice to welcome bucket
   * (capped by current balance and active expiry window).
   */
  static async restoreWelcomeSliceAfterCancelRefund(userId, refundThb) {
    const uid = String(userId || '').trim();
    const r = round2(refundThb);
    if (!uid || r <= 0) return { success: true };
    const { data: uw, error } = await supabaseAdmin
      .from('user_wallets')
      .select('balance_thb,welcome_bonus_remaining_thb,welcome_bonus_expires_at')
      .eq('user_id', uid)
      .maybeSingle();
    if (error) return { success: false, error: error.message };
    const exp = uw?.welcome_bonus_expires_at;
    if (!exp || new Date(exp) <= new Date()) return { success: true, skipped: true };
    const bal = round2(Number(uw?.balance_thb ?? 0));
    const wr = round2(Number(uw?.welcome_bonus_remaining_thb ?? 0));
    const newWr = round2(Math.min(bal, wr + r));
    const { error: upErr } = await supabaseAdmin
      .from('user_wallets')
      .update({ welcome_bonus_remaining_thb: newWr })
      .eq('user_id', uid);
    if (upErr) return { success: false, error: upErr.message };
    return { success: true };
  }

  static async reduceWelcomePortionAfterSpend(userId, debitAmountThb) {
    const uid = String(userId || '').trim();
    const debit = round2(debitAmountThb);
    if (!uid || debit <= 0) return { success: true };
    const { data: w, error: readErr } = await supabaseAdmin
      .from('user_wallets')
      .select('welcome_bonus_remaining_thb')
      .eq('user_id', uid)
      .maybeSingle();
    if (readErr) return { success: false, error: readErr.message };
    const prev = round2(Number(w?.welcome_bonus_remaining_thb ?? 0));
    if (prev <= 0) return { success: true };
    const take = Math.min(prev, debit);
    const { error } = await supabaseAdmin
      .from('user_wallets')
      .update({ welcome_bonus_remaining_thb: round2(prev - take) })
      .eq('user_id', uid);
    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  /**
   * SSOT: wallet bonuses for checkout can be used only after email verification OR Telegram link (SMS later).
   */
  static async getWalletActivation(userId) {
    const uid = String(userId || '').trim();
    if (!uid) return { ok: false, emailVerified: false, telegramLinked: false, status: 400 };
    const { data: p, error } = await supabaseAdmin
      .from('profiles')
      .select('is_verified, telegram_linked')
      .eq('id', uid)
      .maybeSingle();
    if (error) return { ok: false, emailVerified: false, telegramLinked: false, status: 500, error: error.message };
    const emailVerified = p?.is_verified === true;
    const telegramLinked = p?.telegram_linked === true;
    return {
      ok: true,
      emailVerified,
      telegramLinked,
      walletSpendAllowed: emailVerified || telegramLinked,
    };
  }

  static async assertWalletSpendAllowed(userId) {
    const act = await this.getWalletActivation(userId);
    if (!act.ok) return { ok: false, error: act.error || 'PROFILE_READ_FAILED', status: act.status || 500 };
    if (!act.walletSpendAllowed) {
      return { ok: false, error: 'WALLET_ACTIVATION_REQUIRED', status: 403 };
    }
    return { ok: true };
  }

  static async spendFunds(userId, amountThb, bookingId, metadata = {}) {
    const ref = bookingId ? `booking:${String(bookingId)}:wallet_spend` : null;
    const res = await this.applyOperation({
      userId,
      amountThb,
      operationType: 'debit',
      type: 'checkout_wallet_spend',
      referenceId: ref,
      metadata: {
        ...metadata,
        bookingId: bookingId ? String(bookingId) : null,
      },
    });
    if (res.success && res.data?.applied === true && round2(amountThb) > 0) {
      await this.reduceWelcomePortionAfterSpend(userId, amountThb);
    }
    return res;
  }

  static async getWalletSummary(userId) {
    const wallet = await this.getOrCreateWallet(userId);
    if (!wallet.success) return wallet;
    const activation = await this.getWalletActivation(userId);
    const { data: txRows, error: txError } = await supabaseAdmin
      .from('wallet_transactions')
      .select('id,operation_type,amount_thb,tx_type,reference_id,expires_at,created_at')
      .eq('user_id', String(userId))
      .order('created_at', { ascending: false })
      .limit(20);
    if (txError) {
      return { success: false, error: txError.message || 'WALLET_TX_READ_FAILED', status: 500 };
    }
    return {
      success: true,
      data: {
        wallet: wallet.data,
        recentTransactions: txRows || [],
        activation: activation.ok
          ? {
              emailVerified: activation.emailVerified,
              telegramLinked: activation.telegramLinked,
              walletSpendAllowed: activation.walletSpendAllowed,
            }
          : null,
      },
    };
  }

  static async getWalletPolicy() {
    const general = await PricingService.getGeneralPricingSettings();
    const walletMaxDiscountPercent = clamp(
      general?.wallet_max_discount_percent ?? general?.walletMaxDiscountPercent ?? 30,
      0,
      100,
    );
    const welcomeBonusAmount = round2(
      clamp(general?.welcome_bonus_amount ?? general?.welcomeBonusAmount ?? 0, 0, 1_000_000_000),
    );
    return {
      walletMaxDiscountPercent,
      welcomeBonusAmount,
    };
  }
}

export default WalletService;

