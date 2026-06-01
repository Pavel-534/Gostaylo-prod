/**
 * Stage 124.4 — Executive summary для Financial Intelligence Dashboard (read-only).
 * SSOT: booking-financial-fact + FinancialReportingService + referral accounting + ledger reconcile.
 */
import { supabaseAdmin } from '@/lib/supabase';
import LedgerService from '@/lib/services/ledger.service.js';
import FinancialReportingService from '@/lib/finance/reporting.service.js';
import { loadReferralAccountingSnapshot } from '@/lib/admin/referral-accounting-snapshot.js';
import { isFintechTestBookingRow } from '@/lib/admin/fintech-test-data-markers.js';
import { round2 } from '@/lib/services/marketing/referral-calculation.js';
import {
  BOOKING_FINANCE_DASHBOARD_STATUSES,
  BOOKING_FINANCE_PIPE_ACTIVE_STATUSES,
  ESCROW_PIPELINE_STATUSES,
} from '@/lib/booking/status-sets.js';
import {
  resolveAnalyticsPeriod,
  calcPeriodDeltaPct,
} from '@/lib/analytics/core/period-resolver.js';
import {
  aggregateBookingFinancialFacts,
  fetchBookingFinancialFacts,
} from '@/lib/analytics/facts/booking-financial-fact.js';
import { getMetricDefinition } from '@/lib/analytics/metrics/metric-registry.js';
import { withAnalyticsCache } from '@/lib/analytics/core/analytics-cache.js';
import { buildEscrowAgingReport } from '@/lib/analytics/reports/escrow-aging.block.js';
import { buildCategoryRollupFromFacts } from '@/lib/analytics/reports/category-rollup.block.js';
import { buildCashPositionBlock } from '@/lib/analytics/reports/cash-position.block.js';
import { buildPeriodInsightsBlock } from '@/lib/analytics/reports/period-insights.block.js';
import { buildJurisdictionInsightBlock } from '@/lib/analytics/reports/jurisdiction-insight.block.js';
import { buildObligationsSummaryBlock } from '@/lib/analytics/reports/obligations-summary.block.js';
import { buildBankReconciliationHint } from '@/lib/analytics/reports/bank-reconciliation.hint.block.js';
import buildReferralRoiReport from '@/lib/analytics/reports/referral-roi.report.js';

const REVENUE_STATUSES = Object.freeze([
  'PAID',
  'PAID_ESCROW',
  'CHECKED_IN',
  'THAWED',
  'READY_FOR_PAYOUT',
  'COMPLETED',
]);

const STUCK_MS = 7 * 24 * 60 * 60 * 1000;

function utcDateKey(iso) {
  const d = new Date(iso || '');
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function buildDailySeries(facts, { fromIso, toIso }) {
  const keys = [];
  const start = new Date(fromIso);
  const end = new Date(toIso);
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const endDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cursor <= endDay) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const byDay = new Map(keys.map((k) => [k, { date: k, gmvThb: 0, platformMarginThb: 0, partnerPayoutThb: 0 }]));
  for (const f of facts) {
    const k = utcDateKey(f.createdAt);
    if (!k || !byDay.has(k)) continue;
    const row = byDay.get(k);
    row.gmvThb += Number(f.subtotalThb) || 0;
    row.platformMarginThb += Number(f.platformMarginThb) || 0;
    row.partnerPayoutThb += Number(f.partnerPayoutThb) || 0;
  }

  return keys.map((k) => {
    const row = byDay.get(k);
    return {
      date: k,
      label: k.slice(8, 10) + '.' + k.slice(5, 7),
      gmvThb: round2(row.gmvThb),
      platformMarginThb: round2(row.platformMarginThb),
      partnerPayoutThb: round2(row.partnerPayoutThb),
    };
  });
}

async function fetchEscrowPipeline(excludeTest) {
  const counts = {};
  let partnerLiabilityThb = 0;
  let stuckCount = 0;
  const now = Date.now();

  for (const status of ESCROW_PIPELINE_STATUSES) {
    const { data } = await supabaseAdmin
      .from('bookings')
      .select('id, partner_earnings_thb, updated_at, guest_name, special_requests, renter_id, partner_id, listing_id')
      .eq('status', status)
      .limit(5000);

    let c = 0;
    for (const row of data || []) {
      if (excludeTest && isFintechTestBookingRow(row)) continue;
      c += 1;
      partnerLiabilityThb += Number(row.partner_earnings_thb) || 0;
      const updated = Date.parse(String(row.updated_at || ''));
      if (Number.isFinite(updated) && now - updated > STUCK_MS && status !== 'READY_FOR_PAYOUT') {
        stuckCount += 1;
      }
    }
    counts[status] = c;
  }

  return {
    counts,
    partnerLiabilityThb: round2(partnerLiabilityThb),
    stuckCount,
    totalInPipeline: Object.values(counts).reduce((a, b) => a + b, 0),
  };
}

async function fetchReferralPeriodBlock(fromIso, toIso) {
  const { earnedRows, clawbackRows } = await FinancialReportingService.fetchReferralLedgerBundle({
    fromIso,
    toIso,
  });

  const bookingIds = [...new Set((earnedRows || []).map((r) => r.booking_id).filter(Boolean))];
  const metrics = await FinancialReportingService.computeReferralPeriodMetrics({
    fromIso,
    toIso,
    earnedRows,
    clawbackRows,
    commissionBookingIds: bookingIds,
  });

  const heldOutstandingThb = await FinancialReportingService.fetchReferralHeldOutstandingThb();

  return {
    ...metrics,
    heldOutstandingThb: round2(heldOutstandingThb),
    earnedRowsCount: earnedRows.length,
    clawbackRowsCount: clawbackRows.length,
  };
}

function buildKpiCards(currentAgg, previousAgg, referralCurrent, referralPrevious, escrow, accounting) {
  const defs = [
    { id: 'gmvThb', current: currentAgg.gmvThb, previous: previousAgg.gmvThb },
    { id: 'platformMarginThb', current: currentAgg.platformMarginThb, previous: previousAgg.platformMarginThb },
    { id: 'guestPayableThb', current: currentAgg.guestPayableThb, previous: previousAgg.guestPayableThb },
    { id: 'ruFeeThb', current: currentAgg.ruFeeThb, previous: previousAgg.ruFeeThb },
    { id: 'krFeeThb', current: currentAgg.krFeeThb, previous: previousAgg.krFeeThb },
    { id: 'fxMarkupThb', current: currentAgg.fxMarkupThb, previous: previousAgg.fxMarkupThb },
    {
      id: 'netReferralMarginThb',
      current: referralCurrent.netMarginThb,
      previous: referralPrevious.netMarginThb,
    },
    {
      id: 'referralRoiIndex',
      current: referralCurrent.roiIndex,
      previous: referralPrevious.roiIndex,
      format: 'ratio',
    },
    {
      id: 'promoTankBalanceThb',
      current: accounting.accounting?.promoTankBalanceThb ?? referralCurrent.promoTankBalanceThb,
      previous: null,
      live: true,
    },
    {
      id: 'referralLiabilityThb',
      current: accounting.accounting?.currentLiabilityThb,
      previous: null,
      live: true,
    },
    {
      id: 'partnerLiabilityThb',
      current: escrow.partnerLiabilityThb,
      previous: null,
      live: true,
    },
  ];

  return defs.map(({ id, current, previous, format, live }) => {
    const def = getMetricDefinition(id);
    return {
      id,
      label: def?.ownerLabel || def?.label || id,
      hint: def?.hint || '',
      unit: def?.unit || 'thb',
      value: current,
      previousValue: previous,
      deltaPct: live ? null : calcPeriodDeltaPct(current, previous),
      live: Boolean(live),
    };
  });
}

function buildAlerts({ escrow, accounting, referralCurrent, reconciliation, currentAgg }) {
  const alerts = [];

  if (escrow.stuckCount > 0) {
    alerts.push({
      severity: 'warning',
      code: 'STUCK_ESCROW',
      title: 'Застрявшие брони в эскроу',
      message: `${escrow.stuckCount} броней без движения > 7 дней (PAID_ESCROW / THAWED).`,
      href: '/admin/finance/intelligence',
      drill: { pipelineOnly: true, escrowAgingMinDays: 7 },
    });
  }

  if (escrow.counts?.READY_FOR_PAYOUT > 0 && escrow.partnerLiabilityThb > 100_000) {
    alerts.push({
      severity: 'info',
      code: 'READY_PAYOUT',
      title: 'Готово к выплате',
      message: `${escrow.counts.READY_FOR_PAYOUT} броней · ฿${escrow.partnerLiabilityThb.toLocaleString('ru-RU')} partner net.`,
      href: '/admin/settings/finances',
    });
  }

  if (accounting.accounting?.monthlySpendAlertTriggered) {
    alerts.push({
      severity: 'critical',
      code: 'REFERRAL_BUDGET',
      title: 'Бюджет рефералки',
      message: 'Месячный spend referral превысил лимит.',
      href: '/admin/marketing',
    });
  } else if (accounting.accounting?.monthlySpendApproaching) {
    alerts.push({
      severity: 'warning',
      code: 'REFERRAL_BUDGET_WARN',
      title: 'Бюджет рефералки',
      message: 'Месячный spend referral приближается к лимиту.',
      href: '/admin/marketing',
    });
  }

  const roi = Number(referralCurrent.roiIndex);
  if (Number.isFinite(roi) && roi > 0 && roi < 1 && Number(referralCurrent.referralSpendThb) > 0) {
    alerts.push({
      severity: 'warning',
      code: 'LOW_REFERRAL_ROI',
      title: 'Низкий ROI рефералки',
      message: `ROI ${roi.toFixed(2)} — бонусы съедают комиссию за период.`,
      href: '/admin/marketing/attribution',
    });
  }

  const drift = Math.abs(Number(reconciliation?.deltaThb) || 0);
  if (drift > 0.01) {
    alerts.push({
      severity: 'critical',
      code: 'LEDGER_DRIFT',
      title: 'Расхождение ledger',
      message: `MVP reconcile delta ฿${drift.toFixed(2)}.`,
      href: '/admin/financial-health',
    });
  }

  const tank = Number(accounting.accounting?.promoTankBalanceThb);
  if (Number.isFinite(tank) && tank < 10_000) {
    alerts.push({
      severity: 'warning',
      code: 'LOW_PROMO_TANK',
      title: 'Низкий promo tank',
      message: `Остаток ฿${tank.toLocaleString('ru-RU')} — проверьте пополнение.`,
      href: '/admin/marketing/budget',
    });
  }

  if (currentAgg.bookingsCount === 0) {
    alerts.push({
      severity: 'info',
      code: 'NO_REVENUE',
      title: 'Нет оплаченных броней',
      message: 'За выбранный период нет броней с revenue-статусами.',
      href: '/admin/bookings',
    });
  }

  return alerts.sort((a, b) => {
    const rank = { critical: 0, warning: 1, info: 2 };
    return (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9);
  });
}

/**
 * @param {{ periodPreset?: string, excludeTest?: boolean, skipCache?: boolean }} [opts]
 */
export async function buildExecutiveSummaryReport(opts = {}) {
  const excludeTest = opts.excludeTest !== false;
  const periodPreset = opts.periodPreset || '30d';
  const cacheKey = `exec-summary:${periodPreset}:${excludeTest ? '1' : '0'}`;

  if (opts.skipCache) {
    return buildExecutiveSummaryReportUncached(opts);
  }

  const result = await withAnalyticsCache(
    cacheKey,
    () => buildExecutiveSummaryReportUncached(opts),
    { ttlMs: 90_000 },
  );

  const { cacheHit, ...report } = result;
  return {
    ...report,
    meta: {
      ...(report.meta || {}),
      cacheHit: Boolean(cacheHit),
    },
  };
}

/**
 * @param {{ periodPreset?: string, excludeTest?: boolean }} [opts]
 */
async function buildExecutiveSummaryReportUncached(opts = {}) {
  const excludeTest = opts.excludeTest !== false;
  const periods = resolveAnalyticsPeriod(opts.periodPreset || '30d');

  const accountingPromise = loadReferralAccountingSnapshot({ excludeTest });

  const [
    currentFacts,
    previousFacts,
    referralCurrent,
    referralPrevious,
    escrow,
    accounting,
    escrowAging,
    cashPosition,
    referralRoiBundle,
  ] = await Promise.all([
    fetchBookingFinancialFacts({
      fromIso: periods.current.fromIso,
      toIso: periods.current.toIso,
      excludeTest,
      statuses: REVENUE_STATUSES,
    }),
    fetchBookingFinancialFacts({
      fromIso: periods.previous.fromIso,
      toIso: periods.previous.toIso,
      excludeTest,
      statuses: REVENUE_STATUSES,
    }),
    fetchReferralPeriodBlock(periods.current.fromIso, periods.current.toIso),
    fetchReferralPeriodBlock(periods.previous.fromIso, periods.previous.toIso),
    fetchEscrowPipeline(excludeTest),
    accountingPromise,
    buildEscrowAgingReport({ excludeTest }),
    accountingPromise.then((snap) =>
      buildCashPositionBlock({ excludeTest, accounting: snap.accounting }),
    ),
    buildReferralRoiReport({ periodPreset: opts.periodPreset || '30d' }).catch(() => null),
  ]);

  let reconciliation = null;
  try {
    reconciliation = await LedgerService.runReconciliationMvp();
  } catch (e) {
    reconciliation = { error: e?.message || String(e) };
  }

  const currentAgg = aggregateBookingFinancialFacts(currentFacts);
  const previousAgg = aggregateBookingFinancialFacts(previousFacts);
  const categoryRollup = buildCategoryRollupFromFacts(currentFacts);
  const chartDaily = buildDailySeries(currentFacts, periods.current);

  const periodInsights = buildPeriodInsightsBlock({
    periodPreset: opts.periodPreset || '30d',
    currentAgg,
    previousAgg,
    referralCurrent,
    referralPrevious,
    escrowPipeline: escrow,
    treasuryFxCostThb:
      cashPosition?.treasuryTimeline?.totals?.fxCostThb ??
      cashPosition?.treasuryConversions?.netCostThb ??
      0,
  });

  const jurisdictionInsight = buildJurisdictionInsightBlock({
    currentFacts,
    currentAgg,
    previousAgg,
    cashPosition,
  });

  const obligationsSummary = buildObligationsSummaryBlock({
    escrowPipeline: escrow,
    cashPosition,
  });

  const bankReconciliationHint = buildBankReconciliationHint({
    reconciliation,
    cashPosition,
  });

  const referralChartDaily = await (async () => {
    try {
      const funnel = await FinancialReportingService.computeReferralFunnelBundle({
        fromIso: periods.current.fromIso,
        toIso: periods.current.toIso,
      });
      return (funnel?.chartDaily || []).map((row) => ({
        date: row.date,
        label: String(row.date || '').slice(8, 10) + '.' + String(row.date || '').slice(5, 7),
        earnedThb: round2(row.earnedThb),
        clicks: row.clicks,
      }));
    } catch {
      return [];
    }
  })();

  const kpiCards = buildKpiCards(
    currentAgg,
    previousAgg,
    referralCurrent,
    referralPrevious,
    escrow,
    accounting,
  );

  const alerts = buildAlerts({
    escrow,
    accounting,
    referralCurrent,
    reconciliation,
    currentAgg,
  });

  return {
    generatedAt: new Date().toISOString(),
    period: periods,
    excludeTest,
    kpiCards,
    bookingRollup: {
      current: currentAgg,
      previous: previousAgg,
      bookingsInPeriod: currentFacts.length,
    },
    categoryRollup,
    periodInsights,
    jurisdictionInsight,
    obligationsSummary,
    bankReconciliationHint,
    jurisdictionSplit: {
      ruFeeThb: jurisdictionInsight.ruFeeThb,
      krFeeThb: jurisdictionInsight.krFeeThb,
      fxMarkupThb: jurisdictionInsight.fxMarkupThb,
      platformMarginThb: jurisdictionInsight.platformMarginThb,
      v2CoveragePct: jurisdictionInsight.v2CoveragePct,
      treasuryFxCostThb: jurisdictionInsight.treasuryFxCostThb,
      ownerNote: jurisdictionInsight.ownerNote,
      displayState: jurisdictionInsight.displayState,
    },
    escrowPipeline: escrow,
    escrowAging,
    cashPosition: {
      ...cashPosition,
      obligations: {
        ...cashPosition.obligations,
        referralLiabilityThb:
          cashPosition.obligations?.referralLiabilityThb ??
          accounting.accounting?.currentLiabilityThb,
        promoTankBalanceThb:
          cashPosition.obligations?.promoTankBalanceThb ??
          accounting.accounting?.promoTankBalanceThb,
      },
    },
    referral: {
      period: referralCurrent,
      periodPrevious: referralPrevious,
      accounting: accounting.accounting,
      roiHighlights: referralRoiBundle?.fiHighlights ?? null,
      liability: {
        currentLiabilityThb: accounting.accounting?.currentLiabilityThb,
        walletExposureThb: accounting.accounting?.walletExposureThb,
        promoTankBalanceThb: accounting.accounting?.promoTankBalanceThb,
        netMarketingCostThb: accounting.accounting?.netMarketingCostThb,
      },
    },
    reconciliation,
    charts: {
      revenueDaily: chartDaily,
      referralDaily: referralChartDaily,
    },
    alerts,
    meta: {
      metricRegistryVersion: '124.9',
      bookingFactSampleSize: currentFacts.length,
      statusesUsed: REVENUE_STATUSES,
      financeDashboardStatuses: BOOKING_FINANCE_DASHBOARD_STATUSES,
      pipeActiveStatuses: BOOKING_FINANCE_PIPE_ACTIVE_STATUSES,
    },
  };
}

export default buildExecutiveSummaryReport;
