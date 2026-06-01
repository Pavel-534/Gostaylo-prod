/**
 * Stage 124.14 — Referral ROI drill-down for one campaign (read-only SSOT).
 */
import FinancialReportingService from '@/lib/finance/reporting.service.js';
import { resolveAnalyticsPeriod } from '@/lib/analytics/core/period-resolver.js';
import { withAnalyticsCache } from '@/lib/analytics/core/analytics-cache.js';
import {
  enrichCampaignPerformanceRows,
  enrichCampaignBudgetFields,
  buildCampaignRoiDailySeries,
  buildCampaignBookingsTable,
  buildReferralBudgetAlerts,
  buildReferralRealtimeAlerts,
  computeCacThb,
  fetchSuspiciousBookingIds,
  mergeSuspiciousBookingIdsFromLedger,
  filterLedgerRowsExcludingBookings,
  computePeriodRoiFromLedger,
  buildFraudAdjustedRoiBlock,
  buildCampaignLtvRetentionBlock,
  campaignSlugFromLedgerRow,
} from '@/lib/analytics/metrics/campaign-performance.metrics.js';
import { listReferralCampaigns } from '@/lib/services/marketing/referral-campaigns.service.js';
import { decodeCampaignSlugParam } from '@/lib/admin/marketing-roi-routes.js';

/**
 * @param {string} slugParam URL or raw slug
 */
export function resolveCampaignSlugForReport(slugParam) {
  if (slugParam === '(default)') return '(default)';
  return decodeCampaignSlugParam(slugParam);
}

/**
 * @param {{ campaignSlug: string, periodPreset?: string, skipCache?: boolean }} opts
 */
export async function buildReferralCampaignRoiReport(opts) {
  const campaignSlug = resolveCampaignSlugForReport(opts.campaignSlug);
  const periodPreset = opts.periodPreset || '30d';
  const cacheKey = `referral-campaign-roi:${campaignSlug}:${periodPreset}`;

  if (opts.skipCache) {
    return buildReferralCampaignRoiReportUncached({ campaignSlug, periodPreset });
  }

  const result = await withAnalyticsCache(
    cacheKey,
    () => buildReferralCampaignRoiReportUncached({ campaignSlug, periodPreset }),
    { ttlMs: 90_000 },
  );
  const { cacheHit, ...report } = result;
  return { ...report, meta: { ...(report.meta || {}), cacheHit: Boolean(cacheHit) } };
}

async function buildReferralCampaignRoiReportUncached({ campaignSlug, periodPreset }) {
  const periods = resolveAnalyticsPeriod(periodPreset);
  const { fromIso, toIso } = periods.current;

  const { earnedRows, clawbackRows } = await FinancialReportingService.fetchReferralLedgerBundle({
    fromIso,
    toIso,
  });

  const slugFilter = (r) => campaignSlugFromLedgerRow(r) === campaignSlug;
  const suspiciousFromAttr = await fetchSuspiciousBookingIds({
    fromIso,
    toIso,
    campaignSlug: campaignSlug === '(default)' ? '' : campaignSlug,
  });
  const suspiciousBookingIds = mergeSuspiciousBookingIdsFromLedger(
    (earnedRows || []).filter(slugFilter),
    suspiciousFromAttr,
  );

  const filteredEarned = filterLedgerRowsExcludingBookings(
    (earnedRows || []).filter(slugFilter),
    suspiciousBookingIds,
  );
  const filteredClawback = filterLedgerRowsExcludingBookings(
    (clawbackRows || []).filter(slugFilter),
    suspiciousBookingIds,
  );

  const [allCampaignRows, campaignRegistry, chartDaily, chartDailyAdjusted, bookings, ltvRetention, fraudAdjustedLedger] =
    await Promise.all([
      FinancialReportingService.buildCampaignMetricsRows({
        fromIso,
        toIso,
        campaignSlugFilter: campaignSlug === '(default)' ? '' : campaignSlug,
      }),
      listReferralCampaigns().catch(() => []),
      buildCampaignRoiDailySeries(earnedRows, campaignSlug),
      buildCampaignRoiDailySeries(filteredEarned, campaignSlug),
      buildCampaignBookingsTable(earnedRows, clawbackRows, campaignSlug),
      buildCampaignLtvRetentionBlock(earnedRows, campaignSlug),
      computePeriodRoiFromLedger(filteredEarned, filteredClawback),
    ]);

  const campaignRowsRaw = (allCampaignRows || []).filter(
    (r) => String(r.campaignSlug || '(default)') === campaignSlug,
  );

  const enriched = await enrichCampaignPerformanceRows(campaignRowsRaw, {
    earnedRows,
    clawbackRows,
  });
  const withBudget = enrichCampaignBudgetFields(enriched, campaignRegistry);
  const campaign =
    withBudget.find((c) => c.campaignSlug === campaignSlug) ||
    withBudget[0] || {
      campaignSlug,
      campaignName: campaignSlug,
      spendThb: 0,
      commissionThb: 0,
      roiIndex: null,
    };

  const guestsCount = Number(campaign.firstBookingsCount) || Number(campaign.signupsCount) || 0;
  const cacThb = computeCacThb(campaign.spendThb, guestsCount);

  const budgetAlerts = buildReferralBudgetAlerts([campaign], {
    earnedBonusesThb: campaign.spendThb,
    promoTankBalanceThb: null,
  });
  const realtimeAlerts = buildReferralRealtimeAlerts({
    overall: { roiIndex: campaign.roiIndex, earnedBonusesThb: campaign.spendThb },
    campaigns: [campaign],
    budgetAlerts,
  });

  let ownerNote = 'За период нет начислений по этой кампании.';
  if (Number(campaign.spendThb) > 0 && campaign.roiIndex != null) {
    ownerNote =
      campaign.roiIndex >= 1
        ? `Кампания окупается: ROI ${Number(campaign.roiIndex).toFixed(2)}, net ${Number(campaign.netEffectThb).toLocaleString('ru-RU')} ฿.`
        : `ROI ${Number(campaign.roiIndex).toFixed(2)} ниже 1 — проверьте бонусы и качество трафика.`;
  }

  const fraudAdjusted = buildFraudAdjustedRoiBlock(
    { spendThb: campaign.spendThb, roiIndex: campaign.roiIndex },
    fraudAdjustedLedger,
    suspiciousBookingIds.size,
  );

  return {
    generatedAt: new Date().toISOString(),
    campaignSlug,
    period: periods,
    campaign,
    summary: {
      roiIndex: campaign.roiIndex,
      cacThb,
      guestsAcquired: guestsCount,
      spendThb: campaign.spendThb,
      commissionThb: campaign.commissionThb,
      netEffectThb: campaign.netEffectThb,
      clawbackThb: campaign.clawbackThb,
      ownerNote,
    },
    fraudAdjusted,
    ltvRetention,
    chartDaily,
    chartDailyAdjusted,
    bookings,
    realtimeAlerts: budgetAlerts,
    meta: {
      reportVersion: '124.16',
      bookingsCount: bookings.length,
      suspiciousBookingsCount: suspiciousBookingIds.size,
    },
  };
}

export default buildReferralCampaignRoiReport;
