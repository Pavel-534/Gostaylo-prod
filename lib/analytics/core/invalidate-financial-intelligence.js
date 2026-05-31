/**
 * Stage 124.8 — единая инвалидация кэша Financial Intelligence (read-only analytics).
 */
import { invalidateAnalyticsCache } from '@/lib/analytics/core/analytics-cache.js';

const FI_PREFIXES = ['exec-summary:', 'booking-pl:', 'referral-roi:'];

/**
 * Сбросить in-process кэш дашборда и P&L (после treasury / batch / FX).
 */
export function invalidateFinancialIntelligenceCache() {
  for (const prefix of FI_PREFIXES) {
    invalidateAnalyticsCache(prefix);
  }
}

export default invalidateFinancialIntelligenceCache;
