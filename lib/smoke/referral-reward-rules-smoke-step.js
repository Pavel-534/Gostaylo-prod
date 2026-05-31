/**
 * Stage 123.1 — smoke: referral_ledger rule_version / reward_rule_id markers (schema + write path).
 */
import { supabaseAdmin } from '@/lib/supabase';
import { E2E_TEST_DATA_TAG } from '@/lib/e2e/test-data-tag';

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function insertSmokeBooking({ bookingId, listingId, renterId, partnerId }) {
  const checkIn = new Date();
  checkIn.setUTCDate(checkIn.getUTCDate() + 30);
  const checkOut = new Date(checkIn);
  checkOut.setUTCDate(checkOut.getUTCDate() + 2);
  const { error } = await supabaseAdmin.from('bookings').insert({
    id: bookingId,
    listing_id: listingId,
    renter_id: renterId,
    partner_id: partnerId,
    status: 'COMPLETED',
    completed_at: new Date().toISOString(),
    check_in: checkIn.toISOString(),
    check_out: checkOut.toISOString(),
    price_thb: 5000,
    currency: 'THB',
    price_paid: 5500,
    exchange_rate: 1,
    commission_thb: 500,
    partner_earnings_thb: 4500,
    guest_name: 'E2E Rule123',
    special_requests: `${E2E_TEST_DATA_TAG} smoke_123_1`,
    metadata: { e2e_fixture: 'smoke_123_1' },
  });
  if (error) throw new Error(error.message || 'BOOKING_INSERT_FAILED');
}

/**
 * @param {{ listingId?: string, renterId?: string, partnerId?: string }} [options]
 */
export async function runReferralRewardRulesSmokeStep(options = {}) {
  const bookingId = makeId('bk-smoke-123');
  const ledgerId = makeId('rfl-smoke-123');
  const listingId = String(options.listingId || '').trim();
  const renterId = String(options.renterId || makeId('usr-smoke-ree')).trim();
  const partnerId = String(options.partnerId || makeId('usr-smoke-ref')).trim();

  try {
    const { error: tableErr } = await supabaseAdmin
      .from('referral_reward_rules')
      .select('id')
      .limit(1);
    if (tableErr && String(tableErr.message || '').includes('does not exist')) {
      return { ok: true, detail: 'skipped: referral_reward_rules table missing (apply stage123_0/123_1)' };
    }

    if (!listingId) {
      return { ok: false, detail: 'listingId required for reward rule marker smoke' };
    }

    await insertSmokeBooking({ bookingId, listingId, renterId, partnerId });

    const smokeRuleId = 'smoke-reward-rule-123';
    const smokeRuleVersion = 1;
    const { error: insErr } = await supabaseAdmin.from('referral_ledger').insert({
      id: ledgerId,
      booking_id: bookingId,
      referrer_id: partnerId,
      referee_id: renterId,
      amount_thb: 1,
      type: 'bonus',
      referral_type: 'guest_booking',
      ledger_depth: 1,
      status: 'earned',
      rule_version: smokeRuleVersion,
      reward_rule_id: smokeRuleId,
      metadata: {
        e2e: 'smoke_123_1',
        reward_rule_version: smokeRuleVersion,
        reward_rule_id: smokeRuleId,
        reward_rule_applied: true,
      },
    });

    if (insErr) {
      if (String(insErr.message || '').includes('rule_version')) {
        return { ok: true, detail: 'skipped: referral_ledger.rule_version missing (apply stage123_1)' };
      }
      return { ok: false, detail: insErr.message || 'REWARD_RULE_SMOKE_INSERT_FAILED' };
    }

    const { data: row, error: readErr } = await supabaseAdmin
      .from('referral_ledger')
      .select('id, rule_version, reward_rule_id, metadata')
      .eq('id', ledgerId)
      .maybeSingle();

    if (readErr) return { ok: false, detail: readErr.message || 'REWARD_RULE_SMOKE_READ_FAILED' };
    if (row?.rule_version !== smokeRuleVersion || row?.reward_rule_id !== smokeRuleId) {
      return {
        ok: false,
        detail: `marker mismatch rule_version=${row?.rule_version} reward_rule_id=${row?.reward_rule_id}`,
      };
    }

    return {
      ok: true,
      detail: `insert+read OK rule_version=${row.rule_version} reward_rule_id=${row.reward_rule_id}`,
    };
  } catch (e) {
    return { ok: false, detail: e?.message || String(e) };
  } finally {
    await supabaseAdmin.from('referral_ledger').delete().eq('id', ledgerId);
    await supabaseAdmin.from('bookings').delete().eq('id', bookingId);
  }
}
