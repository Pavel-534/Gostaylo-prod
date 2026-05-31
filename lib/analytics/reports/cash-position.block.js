/**
 * Stage 124.5 — Cash position & treasury snapshot (read-only, FinTech SSOT reuse).
 */
import { supabaseAdmin } from '@/lib/supabase';
import { loadTreasuryRailsSummary } from '@/lib/treasury/treasury-rails-summary.js';
import { loadReferralAccountingSnapshot } from '@/lib/admin/referral-accounting-snapshot.js';
import { round2 } from '@/lib/services/marketing/referral-calculation.js';
import { buildTreasuryTimelineBlock } from '@/lib/analytics/reports/treasury-timeline.block.js';

const MS_DAY = 24 * 60 * 60 * 1000;

async function fetchOpenPayoutBatches() {
  const { data, error } = await supabaseAdmin
    .from('payout_batches')
    .select('id, status, rail, totals_thb, item_count, scheduled_for, locked_at, exported_at, created_at, updated_at')
    .in('status', ['DRAFT', 'LOCKED', 'EXPORTED'])
    .order('updated_at', { ascending: false })
    .limit(10);

  if (error) throw new Error(error.message || 'OPEN_BATCHES_READ_FAILED');

  const batches = (data || []).map((b) => ({
    id: b.id,
    status: b.status,
    rail: b.rail,
    totalsThb: round2(b.totals_thb),
    itemCount: Number(b.item_count) || 0,
    scheduledFor: b.scheduled_for || null,
    lockedAt: b.locked_at || null,
    exportedAt: b.exported_at || null,
    updatedAt: b.updated_at || b.created_at || null,
  }));

  const openPayoutThb = round2(batches.reduce((s, b) => s + (Number(b.totalsThb) || 0), 0));

  return {
    batches,
    openBatchCount: batches.length,
    openPayoutThb,
    nearestBatch: batches[0] || null,
  };
}

async function fetchRecentTreasuryConversions(days = 30) {
  const fromIso = new Date(Date.now() - days * MS_DAY).toISOString();
  const { data, error } = await supabaseAdmin
    .from('ledger_entries')
    .select(
      'id, amount_thb, conversion_from_currency, conversion_to_currency, conversion_fee_thb, conversion_loss_thb, created_at, journal_id',
    )
    .not('conversion_from_currency', 'is', null)
    .gte('created_at', fromIso)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message || 'CONVERSIONS_READ_FAILED');

  let feeThb = 0;
  let lossThb = 0;
  for (const row of data || []) {
    feeThb += Number(row.conversion_fee_thb) || 0;
    lossThb += Number(row.conversion_loss_thb) || 0;
  }

  return {
    periodDays: days,
    count: (data || []).length,
    feeThb: round2(feeThb),
    lossThb: round2(lossThb),
    netCostThb: round2(feeThb + lossThb),
    recent: (data || []).slice(0, 5).map((r) => ({
      id: r.id,
      from: r.conversion_from_currency,
      to: r.conversion_to_currency,
      feeThb: round2(r.conversion_fee_thb),
      lossThb: round2(r.conversion_loss_thb),
      createdAt: r.created_at,
    })),
  };
}

/**
 * @param {{ excludeTest?: boolean, accounting?: Record<string, unknown> | null }} [opts]
 */
export async function buildCashPositionBlock(opts = {}) {
  const excludeTest = opts.excludeTest !== false;

  const [rails, batches, conversions, accountingSnap, treasuryTimeline] = await Promise.all([
    loadTreasuryRailsSummary({ excludeTest }),
    fetchOpenPayoutBatches(),
    fetchRecentTreasuryConversions(30),
    opts.accounting
      ? Promise.resolve({ accounting: opts.accounting })
      : loadReferralAccountingSnapshot({ excludeTest }),
    buildTreasuryTimelineBlock({ days: 30 }),
  ]);

  const accounting = accountingSnap?.accounting || {};

  return {
    readyToPay: {
      totalReadyCount: rails.totalReadyCount,
      totalReadyThb: rails.totalReadyThb,
      awaitingConversion: rails.awaitingConversion,
      rails: rails.rails,
    },
    payoutBatches: batches,
    treasuryConversions: conversions,
    treasuryTimeline,
    obligations: {
      referralLiabilityThb: round2(accounting.currentLiabilityThb),
      promoTankBalanceThb: round2(accounting.promoTankBalanceThb),
      walletExposureThb: round2(accounting.walletExposureThb),
      netMarketingCostThb: round2(accounting.netMarketingCostThb),
    },
    summary: {
      cashAtRiskThb: round2(
        (Number(rails.totalReadyThb) || 0) +
          (Number(batches.openPayoutThb) || 0) +
          (Number(accounting.currentLiabilityThb) || 0),
      ),
      openPayoutThb: batches.openPayoutThb,
      readyForPayoutThb: round2(rails.totalReadyThb),
    },
  };
}
