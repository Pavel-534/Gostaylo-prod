/**
 * Stage 121.1 — cron: earned_held → earned + wallet credit when unlock_at reached.
 */
import { supabaseAdmin } from '@/lib/supabase';
import ReferralLedgerService from '@/lib/services/marketing/referral-ledger.service.js';
import { REFERRAL_STATUSES } from '@/lib/services/marketing/referral-calculation.js';

/**
 * @param {{ limit?: number, dryRun?: boolean }} [options]
 */
export async function runReferralUnlockJob(options = {}) {
  const dryRun = options.dryRun === true;
  const limit = Math.min(500, Math.max(1, Number(options.limit) || 200));
  const nowIso = new Date().toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from('referral_ledger')
    .select('id, booking_id, unlock_at')
    .eq('status', REFERRAL_STATUSES.EARNED_HELD)
    .lte('unlock_at', nowIso)
    .order('unlock_at', { ascending: true })
    .limit(limit * 4);

  if (error) {
    return { success: false, error: error.message || 'HELD_LEDGER_SCAN_FAILED' };
  }

  const bookingIds = [
    ...new Set((rows || []).map((r) => String(r.booking_id || '').trim()).filter(Boolean)),
  ].slice(0, limit);

  if (!bookingIds.length) {
    return {
      success: true,
      dryRun,
      scannedRows: rows?.length || 0,
      bookingCount: 0,
      unlockedCount: 0,
    };
  }

  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      scannedRows: rows?.length || 0,
      bookingCount: bookingIds.length,
      bookingIds: bookingIds.slice(0, 20),
    };
  }

  let unlockedCount = 0;
  let unlockedAmountThb = 0;
  const failures = [];
  for (const bookingId of bookingIds) {
    const result = await ReferralLedgerService.unlockHeldRowsForBooking(bookingId);
    if (result.success !== true) {
      failures.push({ bookingId, error: result.error || 'UNLOCK_FAILED' });
      continue;
    }
    unlockedCount += Number(result.unlockedCount) || 0;
    unlockedAmountThb += Number(result.unlockedAmountThb) || 0;
  }

  return {
    success: failures.length === 0,
    scannedRows: rows?.length || 0,
    bookingCount: bookingIds.length,
    unlockedCount,
    unlockedAmountThb: Math.round(unlockedAmountThb * 100) / 100,
    failureCount: failures.length,
    failures: failures.length ? failures.slice(0, 12) : undefined,
  };
}
