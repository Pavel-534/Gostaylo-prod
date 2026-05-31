/**
 * Stage 124.5 — полный P&L одной брони (snapshot + ledger + referral, read-only).
 */
import { supabaseAdmin } from '@/lib/supabase';
import { round2 } from '@/lib/services/marketing/referral-calculation.js';
import { readBookingFinancialFact } from '@/lib/analytics/facts/booking-financial-fact.js';

const BOOKING_PL_SELECT = `
  id, status, created_at, updated_at, partner_id, renter_id, listing_id,
  price_thb, commission_thb, partner_earnings_thb, price_paid, exchange_rate, currency,
  pricing_snapshot, metadata, escrow_thaw_at,
  listing:listings(category_id, categories(slug))
`;

function pickSnapshotSections(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return { feeSplitV2: null, finalBreakdown: null, settlementV3: null, version: 0 };
  }
  return {
    version: snapshot.v ?? (snapshot.fee_split_v2 ? 1 : 0),
    feeSplitV2: snapshot.fee_split_v2 || null,
    finalBreakdown: snapshot.final_breakdown || null,
    settlementV3: snapshot.settlement_v3 || null,
  };
}

async function fetchLedgerBlock(bookingId) {
  const { data: journals, error: jErr } = await supabaseAdmin
    .from('ledger_journals')
    .select('id, event_type, created_at, metadata, idempotency_key')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true });

  if (jErr) throw new Error(jErr.message || 'LEDGER_JOURNALS_READ_FAILED');
  if (!journals?.length) {
    return { journals: [], legs: [], capturePosted: false };
  }

  const journalIds = journals.map((j) => j.id);
  const { data: entries, error: eErr } = await supabaseAdmin
    .from('ledger_entries')
    .select('id, journal_id, account_id, side, amount_thb, amount_rub, metadata, created_at')
    .in('journal_id', journalIds)
    .order('created_at', { ascending: true });

  if (eErr) throw new Error(eErr.message || 'LEDGER_ENTRIES_READ_FAILED');

  const accountIds = [...new Set((entries || []).map((e) => e.account_id).filter(Boolean))];
  const codeById = new Map();
  if (accountIds.length) {
    const { data: accounts } = await supabaseAdmin
      .from('ledger_accounts')
      .select('id, code, name')
      .in('id', accountIds);
    for (const a of accounts || []) {
      codeById.set(a.id, { code: a.code, name: a.name });
    }
  }

  const legs = (entries || []).map((e) => {
    const acct = codeById.get(e.account_id) || {};
    return {
      id: e.id,
      journalId: e.journal_id,
      accountId: e.account_id,
      accountCode: acct.code || null,
      accountName: acct.name || null,
      side: e.side,
      amountThb: round2(e.amount_thb),
      amountRub: e.amount_rub != null ? round2(e.amount_rub) : null,
      createdAt: e.created_at,
    };
  });

  return {
    journals: (journals || []).map((j) => ({
      id: j.id,
      eventType: j.event_type,
      createdAt: j.created_at,
      idempotencyKey: j.idempotency_key || null,
    })),
    legs,
    capturePosted: journals.some((j) => j.event_type === 'BOOKING_PAYMENT_CAPTURED'),
  };
}

async function fetchReferralBlock(bookingId) {
  const { data, error } = await supabaseAdmin
    .from('referral_ledger')
    .select('id, amount_thb, status, tx_type, referrer_id, referee_id, earned_at, created_at, metadata')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message || 'REFERRAL_LEDGER_READ_FAILED');

  let earnedThb = 0;
  let clawbackThb = 0;
  let pendingThb = 0;

  const rows = (data || []).map((r) => {
    const amt = round2(r.amount_thb);
    const status = String(r.status || '').toLowerCase();
    if (status === 'earned' || status === 'earned_held') earnedThb += amt;
    else if (status === 'canceled' || status === 'clawback') clawbackThb += amt;
    else if (status === 'pending') pendingThb += amt;

    return {
      id: r.id,
      amountThb: amt,
      status: r.status,
      txType: r.tx_type,
      referrerId: r.referrer_id,
      refereeId: r.referee_id,
      earnedAt: r.earned_at || r.created_at,
    };
  });

  return {
    rows,
    earnedThb: round2(earnedThb),
    clawbackThb: round2(clawbackThb),
    pendingThb: round2(pendingThb),
    netReferralCostThb: round2(Math.max(0, earnedThb - clawbackThb)),
  };
}

/**
 * @param {string} bookingId
 */
export async function buildBookingPlReport(bookingId) {
  const id = String(bookingId || '').trim();
  if (!id) return { success: false, error: 'BOOKING_ID_REQUIRED' };

  const factResult = await readBookingFinancialFact(id);
  if (!factResult.success) return factResult;

  const { data: booking, error: bErr } = await supabaseAdmin
    .from('bookings')
    .select(BOOKING_PL_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (bErr) return { success: false, error: bErr.message || 'BOOKING_READ_FAILED' };
  if (!booking) return { success: false, error: 'BOOKING_NOT_FOUND' };

  const snapshotRaw =
    booking.pricing_snapshot && typeof booking.pricing_snapshot === 'object'
      ? booking.pricing_snapshot
      : {};

  const [ledger, referral] = await Promise.all([
    fetchLedgerBlock(id),
    fetchReferralBlock(id),
  ]);

  const fact = factResult.data;
  const platformMarginThb = Number(fact.platformMarginThb) || 0;
  const referralCostThb = referral.netReferralCostThb;
  const jurisdictionOutflowThb = round2(
    (Number(fact.ruFeeThb) || 0) +
      (Number(fact.krFeeThb) || 0) +
      (Number(fact.fxMarkupThb) || 0),
  );
  const insuranceReserveThb = Number(fact.insuranceReserveThb) || 0;
  const netPlatformMarginThb = round2(platformMarginThb - referralCostThb);
  const netAfterAllThb = round2(
    platformMarginThb -
      referralCostThb -
      (jurisdictionOutflowThb > 0 ? jurisdictionOutflowThb : 0) -
      insuranceReserveThb,
  );

  return {
    success: true,
    data: {
      bookingId: id,
      generatedAt: new Date().toISOString(),
      fact,
      snapshot: pickSnapshotSections(snapshotRaw),
      guest: {
        currency: fact.currency,
        subtotalThb: fact.subtotalThb,
        guestPayableThb: fact.guestBruttoThb || fact.guestPayableThb,
        guestServiceFeeThb: fact.guestServiceFeeThb,
      },
      partner: {
        partnerId: fact.partnerId,
        partnerPayoutThb: fact.partnerPayoutThb,
        hostCommissionThb: fact.hostCommissionThb,
      },
      jurisdiction: {
        ruFeeThb: fact.ruFeeThb,
        krFeeThb: fact.krFeeThb,
        fxMarkupThb: fact.fxMarkupThb,
        platformMarginPoolThb: fact.platformMarginPoolThb,
        insuranceReserveThb,
        breakdownSource: fact.breakdownSource,
      },
      ledger,
      referral,
      pl: {
        platformGrossMarginThb: round2(platformMarginThb),
        referralCostThb,
        jurisdictionOutflowThb,
        insuranceReserveThb,
        netPlatformMarginThb,
        netAfterAllThb,
        partnerPayoutThb: fact.partnerPayoutThb,
        taxableMarginThb: fact.taxableMarginThb,
        formula:
          'чистая после всего = маржа − реферал − RU/KG/FX (из снимка) − страховой резерв',
      },
    },
  };
}

export default buildBookingPlReport;
