/**
 * Stage 124.4 — Analytics SSOT barrel exports.
 */
export { resolveAnalyticsPeriod, calcPeriodDeltaPct, ANALYTICS_PERIOD_PRESETS } from './core/period-resolver.js';
export { withAnalyticsCache, getCachedAnalytics, invalidateAnalyticsCache } from './core/analytics-cache.js';
export {
  buildBookingFinancialFactFromRow,
  readBookingFinancialFact,
  fetchBookingFinancialFacts,
  queryBookingFinancialFactsPage,
  aggregateBookingFinancialFacts,
} from './facts/booking-financial-fact.js';
export { METRIC_REGISTRY, getMetricDefinition, pickMetricDefinitions } from './metrics/metric-registry.js';
export { default as buildExecutiveSummaryReport } from './reports/executive-summary.report.js';
export { default as buildBookingPlReport } from './reports/booking-pl-report.js';
export { buildEscrowAgingReport } from './reports/escrow-aging.block.js';
export { buildCashPositionBlock } from './reports/cash-position.block.js';
export { invalidateFinancialIntelligenceCache } from './core/invalidate-financial-intelligence.js';
export { buildPeriodInsightsBlock } from './reports/period-insights.block.js';
export { buildJurisdictionInsightBlock } from './reports/jurisdiction-insight.block.js';
export { buildTreasuryTimelineBlock } from './reports/treasury-timeline.block.js';
export { buildReferralRoiReport, default as buildReferralRoiReportDefault } from './reports/referral-roi.report.js';
export {
  enrichCampaignPerformanceRows,
  buildSourceChannelBreakdown,
  buildRoiDailySeries,
  SOURCE_CHANNEL_LABELS,
} from './metrics/campaign-performance.metrics.js';
