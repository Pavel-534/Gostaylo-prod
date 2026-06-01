/**
 * Stage 124.13 — Owner weekly marketing digest (SSOT on referral-roi.report).
 */
import buildReferralRoiReport from '@/lib/analytics/reports/referral-roi.report.js';
import { resolveAnalyticsPeriod } from '@/lib/analytics/core/period-resolver.js';
import { round2 } from '@/lib/services/marketing/referral-calculation.js';

const DIGEST_PERIOD = '7d';

function formatPeriodLabel(period) {
  const from = String(period?.current?.fromIso || '').slice(0, 10);
  const to = String(period?.current?.toIso || '').slice(0, 10);
  if (!from) return 'за 7 дней';
  return `${from} — ${to}`;
}

/**
 * @param {ReturnType<typeof buildReferralRoiReport> extends Promise<infer R> ? R : never} roiReport
 */
export function buildDigestRecommendations(roiReport) {
  /** @type {string[]} */
  const items = [];
  const roi = Number(roiReport?.overall?.roiIndex);
  const spend = round2(roiReport?.overall?.earnedBonusesThb ?? 0);
  const net = round2(roiReport?.profitImpact?.referralNetMarginThb ?? roiReport?.overall?.netMarginThb);
  const worst = roiReport?.campaignRankings?.worst?.[0] || roiReport?.fiHighlights?.worstCampaign;

  if (spend <= 0) {
    items.push('За неделю не было начислений бонусов — дайджест обновится после активности программы.');
    return items;
  }

  if (Number.isFinite(roi) && roi < 1) {
    const hint = worst?.campaignName
      ? `Проверьте кампанию «${worst.campaignName}» (ROI ${worst.roiIndex != null ? Number(worst.roiIndex).toFixed(2) : '—'}).`
      : 'Сократите бонусы или усильте конверсию в первые брони.';
    items.push(`ROI программы ниже 1 (${roi.toFixed(2)}) — расход promo выше комиссии. ${hint}`);
  } else if (Number.isFinite(roi) && roi >= 1) {
    items.push(`Программа окупается: на каждый ฿1 бонусов — ฿${roi.toFixed(2)} комиссии.`);
  }

  if (net < 0) {
    items.push(`Чистая маржа рефералки отрицательная (฿${net.toLocaleString('ru-RU')}) — учтите это в общей прибыли платформы.`);
  }

  for (const alert of roiReport?.realtimeAlerts || []) {
    if (alert.type === 'promo_tank_fast_burn' || alert.type === 'promo_tank_empty') {
      items.push(alert.message);
    }
    if (alert.type === 'campaign_over_budget' && items.length < 5) {
      items.push(alert.message);
    }
  }

  const top = roiReport?.campaignRankings?.top?.[0];
  if (top?.campaignName && Number(top.roiIndex) >= 1) {
    items.push(`Лучшая кампания недели: «${top.campaignName}» (ROI ${Number(top.roiIndex).toFixed(2)}).`);
  }

  return [...new Set(items)].slice(0, 6);
}

/**
 * @param {{ periodPreset?: string, skipCache?: boolean }} [opts]
 */
export async function buildOwnerMarketingDigestReport(opts = {}) {
  const periodPreset = opts.periodPreset || DIGEST_PERIOD;
  const roiReport = await buildReferralRoiReport({
    periodPreset,
    skipCache: opts.skipCache !== false,
  });

  const recommendations = buildDigestRecommendations(roiReport);
  const periodLabel = formatPeriodLabel(roiReport.period);

  return {
    generatedAt: new Date().toISOString(),
    periodPreset,
    periodLabel,
    period: roiReport.period || resolveAnalyticsPeriod(periodPreset),
    summary: {
      roiIndex: roiReport.overall?.roiIndex ?? null,
      cacThb: roiReport.cacSummary?.overall?.cacThb ?? null,
      guestsAcquired: roiReport.cacSummary?.overall?.guestsAcquired ?? 0,
      spendThb: roiReport.cacSummary?.overall?.spendThb ?? roiReport.overall?.earnedBonusesThb ?? 0,
      commissionThb: roiReport.cacSummary?.overall?.commissionThb ?? roiReport.overall?.referredCommissionThb ?? 0,
      netMarginThb: roiReport.profitImpact?.referralNetMarginThb ?? roiReport.overall?.netMarginThb ?? 0,
      promoTankBalanceThb: roiReport.overall?.promoTankBalanceThb ?? 0,
      ownerNote: roiReport.cacSummary?.overall?.ownerNote || roiReport.profitImpact?.ownerNote || '',
    },
    campaignRankings: roiReport.campaignRankings || { top: [], worst: [] },
    alerts: roiReport.realtimeAlerts || [],
    recommendations,
    roiReportMeta: roiReport.meta,
  };
}

export default buildOwnerMarketingDigestReport;
