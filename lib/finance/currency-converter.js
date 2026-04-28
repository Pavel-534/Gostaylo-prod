/**
 * Server-side referral FX: mid-market map from CurrencyService.
 * SSOT свежести один для всего сайта — `EXCHANGE_RATES_DB_TTL_MS` в CurrencyService.
 */

import { getDisplayRateMap, convertAmountThbToCurrency } from '@/lib/services/currency.service'

/**
 * THB per 1 unit (`rate_to_thb`), **без** розничной надбавки (`applyRetailMarkup: false`).
 */
export async function getReferralFairRateMapCached() {
  const map = await getDisplayRateMap({ applyRetailMarkup: false })
  return map && typeof map === 'object' ? { ...map } : { THB: 1 }
}

export { convertAmountThbToCurrency }
