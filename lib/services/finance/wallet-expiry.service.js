/**
 * Stage 71.6 — Welcome bonus expiry sweep + reminder windows (5d / 1d before forfeiture).
 */
import { supabaseAdmin } from '@/lib/supabase';
import WalletService from '@/lib/services/finance/wallet.service';
import ReferralPnlService from '@/lib/services/marketing/referral-pnl.service';
import NotificationService from '@/lib/services/notification.service';
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js';

function round2(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function ceilDaysUntil(expiresAtIso, now) {
  const t = new Date(expiresAtIso).getTime() - now.getTime();
  if (t <= 0) return 0;
  return Math.ceil(t / 86400000);
}

async function promoReturnLedgerExists(refKey) {
  const { data, error } = await supabaseAdmin
    .from('marketing_promo_tank_ledger')
    .select('id')
    .eq('entry_type', 'welcome_bonus_return')
    .contains('metadata', { idempotency_key: refKey })
    .maybeSingle();
  if (error) return false;
  return !!data?.id;
}

async function clearWelcomeTracking(userId) {
  await supabaseAdmin
    .from('user_wallets')
    .update({
      welcome_bonus_remaining_thb: 0,
      welcome_bonus_expires_at: null,
      welcome_notify_5d_sent_at: null,
      welcome_notify_1d_sent_at: null,
    })
    .eq('user_id', userId);
}

/**
 * Forfeit expired welcome slice: debit wallet (idempotent ref), credit marketing promo tank, clear tracking columns.
 */
async function forfeitOneExpiredWelcome(row) {
  const userId = row.user_id;
  const expiresIso = row.welcome_bonus_expires_at;
  const refKey = `welcome_bonus_expiry:${userId}:${expiresIso}`;
  const welcomeRem = round2(Number(row.welcome_bonus_remaining_thb ?? 0));
  const balance = round2(Number(row.balance_thb ?? 0));
  const amount = round2(Math.min(balance, welcomeRem));

  if (!expiresIso || welcomeRem <= 0) {
    await clearWelcomeTracking(userId);
    return 'cleared';
  }

  if (amount <= 0) {
    await clearWelcomeTracking(userId);
    return 'zero_balance';
  }

  const debit = await WalletService.applyOperation({
    userId,
    amountThb: amount,
    operationType: 'debit',
    type: 'welcome_bonus_expiry_debit',
    referenceId: refKey,
    metadata: { trigger: 'welcome_bonus_expiry', forfeited_thb: amount },
  });

  if (!debit.success) {
    const reason = String(debit.error || '');
    if (reason.includes('ALREADY_APPLIED')) {
      const alreadyPot = await promoReturnLedgerExists(refKey);
      if (alreadyPot) {
        await clearWelcomeTracking(userId);
        return 'already_done';
      }
      const promoRetry = await ReferralPnlService.adjustMarketingPromoPot(amount, 'welcome_bonus_return', {
        metadata: {
          user_id: userId,
          idempotency_key: refKey,
          welcome_bonus_expires_at: expiresIso,
          reconcile: true,
        },
      });
      if (!promoRetry.applied) {
        throw new Error(promoRetry.reason || 'PROMO_RETRY_FAILED');
      }
      await clearWelcomeTracking(userId);
      return 'reconciled';
    }
    throw new Error(reason || 'WALLET_DEBIT_FAILED');
  }

  let promo;
  try {
    promo = await ReferralPnlService.adjustMarketingPromoPot(amount, 'welcome_bonus_return', {
      metadata: {
        user_id: userId,
        idempotency_key: refKey,
        welcome_bonus_expires_at: expiresIso,
      },
    });
  } catch (e) {
    void notifySystemAlert(
      `⚠️ <b>Welcome expiry</b>: кошелёк списан, бак не пополнен\n` +
        `user: <code>${escapeSystemAlertHtml(userId)}</code>\n` +
        `amount: <code>${escapeSystemAlertHtml(String(amount))}</code>\n` +
        `<code>${escapeSystemAlertHtml(e?.message || e)}</code>`,
    );
    throw e;
  }

  if (!promo.applied) {
    void notifySystemAlert(
      `⚠️ <b>Welcome expiry</b>: promo adjust not applied\n` +
        `user: <code>${escapeSystemAlertHtml(userId)}</code>\n` +
        `reason: <code>${escapeSystemAlertHtml(String(promo.reason || ''))}</code>`,
    );
    throw new Error(promo.reason || 'PROMO_RETURN_FAILED');
  }

  await clearWelcomeTracking(userId);

  return 'processed';
}

async function dispatchReminderIfDue(row, now, windowDays) {
  const ceil = ceilDaysUntil(row.welcome_bonus_expires_at, now);
  if (ceil !== windowDays) return false;

  const sentCol =
    windowDays === 5 ? 'welcome_notify_5d_sent_at' : 'welcome_notify_1d_sent_at';
  if (row[sentCol]) return false;

  await NotificationService.dispatch('WALLET_WELCOME_EXPIRING', {
    userId: row.user_id,
    windowDays,
    remainingThb: round2(Number(row.welcome_bonus_remaining_thb ?? 0)),
    expiresAtIso: row.welcome_bonus_expires_at,
  });
  return true;
}

/**
 * Cron entry: expire past welcome bonuses, send 5d/1d reminders (ceil-days window).
 */
export async function runWalletWelcomeBonusCron() {
  const now = new Date();
  const expiryStats = { processed: 0, skipped: 0, errors: [] };
  const reminderStats = { sent5: 0, sent1: 0 };

  const { data: expiredRows, error: exErr } = await supabaseAdmin
    .from('user_wallets')
    .select('user_id,balance_thb,welcome_bonus_remaining_thb,welcome_bonus_expires_at')
    .gt('welcome_bonus_remaining_thb', 0)
    .not('welcome_bonus_expires_at', 'is', null)
    .lt('welcome_bonus_expires_at', now.toISOString());

  if (exErr) {
    expiryStats.errors.push({ phase: 'query_expired', message: exErr.message });
  } else {
    for (const row of expiredRows || []) {
      try {
        const r = await forfeitOneExpiredWelcome(row);
        if (r === 'processed') expiryStats.processed += 1;
        else expiryStats.skipped += 1;
      } catch (e) {
        expiryStats.errors.push({ userId: row.user_id, message: e?.message || String(e) });
      }
    }
  }

  const { data: upcomingRows, error: upErr } = await supabaseAdmin
    .from('user_wallets')
    .select(
      'user_id,welcome_bonus_remaining_thb,welcome_bonus_expires_at,welcome_notify_5d_sent_at,welcome_notify_1d_sent_at',
    )
    .gt('welcome_bonus_remaining_thb', 0)
    .not('welcome_bonus_expires_at', 'is', null)
    .gt('welcome_bonus_expires_at', now.toISOString());

  if (upErr) {
    expiryStats.errors.push({ phase: 'query_upcoming', message: upErr.message });
  } else {
    for (const row of upcomingRows || []) {
      try {
        if (await dispatchReminderIfDue(row, now, 5)) reminderStats.sent5 += 1;
      } catch (e) {
        expiryStats.errors.push({
          phase: 'reminder_5d',
          userId: row.user_id,
          message: e?.message || String(e),
        });
      }
    }
    for (const row of upcomingRows || []) {
      try {
        if (await dispatchReminderIfDue(row, now, 1)) reminderStats.sent1 += 1;
      } catch (e) {
        expiryStats.errors.push({
          phase: 'reminder_1d',
          userId: row.user_id,
          message: e?.message || String(e),
        });
      }
    }
  }

  return { ok: true, now: now.toISOString(), expiry: expiryStats, reminders: reminderStats };
}

export default { runWalletWelcomeBonusCron };
