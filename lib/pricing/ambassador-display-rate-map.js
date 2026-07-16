/**
 * Stage 188.3 — ambassador hub rateMap helpers (mid primary, retail bootstrap fallback).
 * `rateMap[c]` = THB per 1 unit of currency (same as GET /api/v2/exchange-rates).
 */

import { normalizeThbPerUnitRate } from '@/lib/finance/thb-per-unit-rate.js'

export function hasAmbassadorFxRate(rateMap, currencyCode) {
  const code = String(currencyCode || 'THB').toUpperCase()
  if (code === 'THB') return true
  const rate = normalizeThbPerUnitRate(code, Number(rateMap?.[code]))
  return rate != null && rate > 0
}

/**
 * Mid-market SSOT per currency; retail bundle fills gaps while mid query / cache loads.
 */
export function mergeAmbassadorDisplayRateMaps(midMap, retailMap) {
  const out = { THB: 1 }
  const keys = new Set([
    ...Object.keys(midMap && typeof midMap === 'object' ? midMap : {}),
    ...Object.keys(retailMap && typeof retailMap === 'object' ? retailMap : {}),
  ])
  for (const code of keys) {
    if (code === 'THB') continue
    const midRate = normalizeThbPerUnitRate(code, Number(midMap?.[code]))
    const retailRate = normalizeThbPerUnitRate(code, Number(retailMap?.[code]))
    if (midRate != null && midRate > 0) out[code] = midRate
    else if (retailRate != null && retailRate > 0) out[code] = retailRate
  }
  return out
}
