/**
 * Stage 121.1 — smoke: earned_held → unlock → wallet; cancel held on refund path.
 */
import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase';
import ReferralLedgerService from '@/lib/services/marketing/referral-ledger.service.js';
import { REFERRAL_STATUSES } from '@/lib/services/marketing/referral-calculation.js';
import { computeReferralUnlockAt } from '@/lib/services/marketing/referral-hold.service.js';
import { STAGE72_REUSE_LISTING_ID } from '@/lib/e2e/test-listing-cleanup';
import { E2E_TEST_DATA_TAG } from '@/lib/e2e/test-data-tag';

function step(name) {
  return { name, ok: false, detail: '', durationMs: 0 };
}

function markDuration(s, t0) {
  s.durationMs = Math.max(0, Date.now() - t0);
}

function pass(s, detail, t0) {
  s.ok = true;
  s.detail = detail;
  markDuration(s, t0);
  return s;
}

function fail(s, detail, t0) {
  s.ok = false;
  s.detail = String(detail || 'failed').slice(0, 500);
  markDuration(s, t0);
  return s;
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function insertSmokeBooking({ bookingId, renterId, partnerId, completedAt }) {
  const tag = `${E2E_TEST_DATA_TAG} smoke_121_1_hold`;
  const checkIn = new Date();
  checkIn.setUTCDate(checkIn.getUTCDate() + 60);
  const checkOut = new Date(checkIn);
  checkOut.setUTCDate(checkOut.getUTCDate() + 2);
  const { error } = await supabaseAdmin.from('bookings').insert({
    id: bookingId,
    listing_id: STAGE72_REUSE_LISTING_ID,
    renter_id: renterId,
    partner_id: partnerId,
    status: 'COMPLETED',
    completed_at: completedAt,
    check_in: checkIn.toISOString(),
    check_out: checkOut.toISOString(),
    price_thb: 5000,
    currency: 'THB',
    price_paid: 5500,
    exchange_rate: 1,
    commission_thb: 500,
    commission_rate: 10,
    applied_commission_rate: 10,
    partner_earnings_thb: 4500,
    guest_name: 'E2E Hold121',
    guest_phone: '0000000121',
    guests_count: 1,
    special_requests: tag,
    pricing_snapshot: { fee_split_v2: { platform_gross_revenue_thb: 500 } },
    metadata: { e2e_fixture: 'smoke_121_1_hold' },
  });
  if (error) throw new Error(error.message || 'BOOKING_INSERT_FAILED');
}

/**
 * @param {{ renterId?: string, partnerId?: string }} [options] — smoke guest/partner profiles (FK)
 * @returns {Promise<{ name: string, ok: boolean, detail: string, durationMs: number }>}
 */
export async function runReferralHoldSmokeStep(options = {}) {
  const s = step('Referral 121.1 hold period');
  const t0 = Date.now();
  const bookingId = `bk-smoke-121-${Date.now().toString(36)}`;
  const bookingCancelId = `bk-smoke-121-cancel-${Date.now().toString(36)}`;
  const referrerId = String(options.partnerId || '').trim() || `usr-smoke-ref-${Date.now().toString(36).slice(0, 10)}`;
  const refereeId = String(options.renterId || '').trim() || `usr-smoke-ree-${Date.now().toString(36).slice(0, 10)}`;
  const ledgerId = makeId('rfl');

  try {
    const completedAt = new Date(Date.now() - 10 * 86400000).toISOString();
    const unlockAt = computeReferralUnlockAt(completedAt, 7);
    if (!unlockAt || Date.parse(unlockAt) > Date.now()) {
      return fail(s, 'unlock_at should be in the past for smoke', t0);
    }

    await insertSmokeBooking({ bookingId, renterId: refereeId, partnerId: referrerId, completedAt });

    const { error: insErr } = await supabaseAdmin.from('referral_ledger').insert({
      id: ledgerId,
      booking_id: bookingId,
      referrer_id: referrerId,
      referee_id: refereeId,
      amount_thb: 12.5,
      type: 'bonus',
      referral_type: 'guest_booking',
      ledger_depth: 1,
      status: REFERRAL_STATUSES.PENDING,
      metadata: { e2e: 'smoke_121_1_hold', split_role: 'referrer' },
    });
    if (insErr) return fail(s, insErr.message || 'LEDGER_INSERT_FAILED', t0);

    const marked = await ReferralLedgerService.markPendingAsEarned(bookingId, {
      referralHoldDays: 7,
      completedAt,
    });
    if (!marked?.held) return fail(s, 'expected held accrual', t0);

    const { data: heldRow } = await supabaseAdmin
      .from('referral_ledger')
      .select('id, status, unlock_at')
      .eq('id', ledgerId)
      .maybeSingle();
    if (heldRow?.status !== REFERRAL_STATUSES.EARNED_HELD) {
      return fail(s, `status=${heldRow?.status}`, t0);
    }

    const { data: creditTx } = await supabaseAdmin
      .from('wallet_transactions')
      .select('id')
      .ilike('reference_id', `referral_ledger:${ledgerId}%`)
      .maybeSingle();
    if (creditTx?.id) return fail(s, 'wallet credited before unlock', t0);

    const unlock = await ReferralLedgerService.unlockHeldRowsForBooking(bookingId);
    if (unlock.unlockedCount !== 1) return fail(s, `unlock count=${unlock.unlockedCount}`, t0);

    const { data: earnedRow } = await supabaseAdmin
      .from('referral_ledger')
      .select('status')
      .eq('id', ledgerId)
      .maybeSingle();
    if (earnedRow?.status !== REFERRAL_STATUSES.EARNED) {
      return fail(s, `after unlock status=${earnedRow?.status}`, t0);
    }

    await insertSmokeBooking({
      bookingId: bookingCancelId,
      renterId: refereeId,
      partnerId: referrerId,
      completedAt: new Date().toISOString(),
    });
    const cancelLedgerId = makeId('rfl');
    await supabaseAdmin.from('referral_ledger').insert({
      id: cancelLedgerId,
      booking_id: bookingCancelId,
      referrer_id: referrerId,
      referee_id: refereeId,
      amount_thb: 5,
      type: 'bonus',
      referral_type: 'guest_booking',
      ledger_depth: 1,
      status: REFERRAL_STATUSES.PENDING,
      metadata: { e2e: 'smoke_121_1_hold_cancel' },
    });
    await ReferralLedgerService.markPendingAsEarned(bookingCancelId, {
      referralHoldDays: 14,
      completedAt: new Date().toISOString(),
    });
    const cancelHeld = await ReferralLedgerService.cancelHeldLedgerForBooking(bookingCancelId, {
      trigger: 'smoke_121_1_refund',
    });
    if (cancelHeld.canceledCount !== 1) {
      return fail(s, `held cancel count=${cancelHeld.canceledCount}`, t0);
    }

    return pass(
      s,
      `held→unlock OK; cancel held=${cancelHeld.canceledCount}; unlock_at=${String(heldRow?.unlock_at || '').slice(0, 10)}`,
      t0,
    );
  } catch (e) {
    return fail(s, e?.message || String(e), t0);
  } finally {
    await supabaseAdmin.from('referral_ledger').delete().in('booking_id', [bookingId, bookingCancelId]);
    await supabaseAdmin.from('bookings').delete().in('id', [bookingId, bookingCancelId]);
  }
}
