/**
 * Stage 124.11 — Referral ROI & Marketing Intelligence (read-only SSOT).
 * Math: FinancialReportingService + lib/analytics/metrics/campaign-performance.metrics.js
 */
import FinancialReportingService from '@/lib/finance/reporting.service.js';
import { round2 } from '@/lib/services/marketing/referral-calculation.js';
import { resolveAnalyticsPeriod, calcPeriodDeltaPct } from '@/lib/analytics/core/period-resolver.js';
import { withAnalyticsCache } from '@/lib/analytics/core/analytics-cache.js';
import {
  enrichCampaignPerformanceRows,
  buildSourceChannelBreakdown,
  buildRoiDailySeries,
} from '@/lib/analytics/metrics/campaign-performance.metrics.js';

async function loadPeriodReferralBlock(fromIso, toIso) {
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
  return { earnedRows, clawbackRows, metrics, bookingIds };
}

/**
 * @param {{ periodPreset?: string, skipCache?: boolean }} [opts]
 */
export async function buildReferralRoiReport(opts = {}) {
  const periodPreset = opts.periodPreset || '30d';
  const cacheKey = `referral-roi:${periodPreset}`;

  if (opts.skipCache) {
    return buildReferralRoiReportUncached(opts);
  }

  const result = await withAnalyticsCache(
    cacheKey,
    () => buildReferralRoiReportUncached(opts),
    { ttlMs: 90_000 },
  );
  const { cacheHit, ...report } = result;
  return {
    ...report,
    meta: { ...(report.meta || {}), cacheHit: Boolean(cacheHit) },
  };
}

/**
 * @param {{ periodPreset?: string }} [opts]
 */
async function buildReferralRoiReportUncached(opts = {}) {
  const periods = resolveAnalyticsPeriod(opts.periodPreset || '30d');
  const { fromIso, toIso } = periods.current;
  const prev = periods.previous;

  const current = await loadPeriodReferralBlock(fromIso, toIso);

  const [previous, funnel, campaignRowsRaw] = await Promise.all([
    loadPeriodReferralBlock(prev.fromIso, prev.toIso),
    FinancialReportingService.computeReferralFunnelBundle({
      fromIso,
      toIso,
      earnedRows: current.earnedRows,
    }),
    FinancialReportingService.buildCampaignMetricsRows({ fromIso, toIso }),
  ]);

  const campaigns = await enrichCampaignPerformanceRows(campaignRowsRaw, {
    earnedRows: current.earnedRows,
    clawbackRows: current.clawbackRows,
  });

  const [sourceBreakdown, roiChartDaily] = await Promise.all([
    buildSourceChannelBreakdown(funnel.byUtm, current.earnedRows),
    buildRoiDailySeries(funnel.chartDaily, current.earnedRows),
  ]);

  const overall = current.metrics;
  const previousOverall = previous.metrics;

  const sortedCampaigns = [...campaigns].sort(
    (a, b) => (b.roiIndex ?? -1) - (a.roiIndex ?? -1) || b.spendThb - a.spendThb,
  );

  const profitImpact = {
    referralOutflowThb: overall.earnedBonusesThb,
    referralNetMarginThb: overall.netMarginThb,
    clawbackThb: overall.clawbackThb,
    roiIndex: overall.roiIndex,
    roiPct: overall.roiPct,
    promoTankBalanceThb: overall.promoTankBalanceThb,
    ownerNote:
      overall.roiIndex != null && overall.roiIndex >= 1
        ? `На каждый ฿1 бонусов программа принесла ฿${overall.roiIndex.toFixed(2)} комиссии.`
        : overall.earnedBonusesThb > 0
          ? 'ROI ниже 1 — расход на бонусы превышает комиссию с реферальных броней за период.'
          : 'За период нет начисленных бонусов — ROI появится после первых выплат.',
  };

  return {
    generatedAt: new Date().toISOString(),
    period: periods,
    overall: {
      ...overall,
      vsPrevious: {
        roiDeltaPct: calcPeriodDeltaPct(overall.roiIndex, previousOverall.roiIndex),
        netMarginDeltaPct: calcPeriodDeltaPct(overall.netMarginThb, previousOverall.netMarginThb),
        spendDeltaPct: calcPeriodDeltaPct(overall.earnedBonusesThb, previousOverall.earnedBonusesThb),
        prevRoiIndex: previousOverall.roiIndex,
        prevNetMarginThb: round2(previousOverall.netMarginThb),
      },
    },
    profitImpact,
    campaigns: sortedCampaigns,
    sourceBreakdown,
    roiChartDaily,
    funnelSummary: funnel.summary,
    meta: {
      reportVersion: '124.11',
      campaignsCount: sortedCampaigns.length,
      bookingIdsInPeriod: current.bookingIds.length,
    },
  };
}

export default buildReferralRoiReport;
